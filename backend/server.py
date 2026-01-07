from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
import base64
import io
from pypdf import PdfReader
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"

# Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CompanySettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    company_name: str
    company_gst_no: str
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CompanySettingsUpdate(BaseModel):
    company_name: str
    company_gst_no: str
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None

class InvoiceData(BaseModel):
    invoice_no: Optional[str] = None
    invoice_date: Optional[str] = None
    # Bill From / Supplier Details
    supplier_name: Optional[str] = None
    supplier_address: Optional[str] = None
    supplier_gst_no: Optional[str] = None
    supplier_contact_person: Optional[str] = None
    supplier_contact_number: Optional[str] = None
    # Bill To / Buyer Details
    buyer_name: Optional[str] = None
    buyer_address: Optional[str] = None
    buyer_gst_no: Optional[str] = None
    buyer_contact_person: Optional[str] = None
    buyer_contact_number: Optional[str] = None
    # Legacy fields for backward compatibility
    address: Optional[str] = None
    gst_no: Optional[str] = None
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None
    # Amount fields
    basic_amount: Optional[float] = None
    gst: Optional[float] = None
    total_amount: Optional[float] = None
    gst_rate: Optional[float] = None
    cgst: Optional[float] = None
    sgst: Optional[float] = None
    igst: Optional[float] = None

class ConfidenceScores(BaseModel):
    invoice_no: float = 0.0
    invoice_date: float = 0.0
    supplier_name: float = 0.0
    address: float = 0.0
    gst_no: float = 0.0
    basic_amount: float = 0.0
    gst: float = 0.0
    total_amount: float = 0.0

class ValidationFlags(BaseModel):
    is_duplicate: bool = False
    gst_mismatch: bool = False
    duplicate_invoice_ids: List[str] = []

class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    invoice_type: str = "purchase"
    filename: str
    file_data: str
    file_type: str
    extracted_data: InvoiceData
    confidence_scores: ConfidenceScores
    validation_flags: ValidationFlags = ValidationFlags()
    status: str = "pending"
    month: Optional[str] = None
    financial_year: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InvoiceUpdate(BaseModel):
    extracted_data: InvoiceData
    status: Optional[str] = None
    invoice_type: Optional[str] = None

class BatchUploadResponse(BaseModel):
    total_files: int
    successful: int
    failed: int
    invoices: List[Invoice]

class ExportRequest(BaseModel):
    invoice_ids: List[str]
    format: str

class MonthlyReport(BaseModel):
    month: str
    purchase_invoices: int
    sales_invoices: int
    total_purchase_amount: float
    total_sales_amount: float
    total_purchase_gst: float
    total_sales_gst: float
    net_gst_payable: float
    gst_breakdown: Dict[str, Any]

# Helper functions
def create_access_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode = {"user_id": user_id, "email": email, "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    return verify_token(token)

def get_month_and_fy(date_str: str) -> tuple:
    """Extract month and financial year from date string"""
    try:
        if '/' in date_str:
            parts = date_str.split('/')
            if len(parts) == 3:
                day, month, year = parts
                date_obj = datetime(int(year), int(month), int(day))
        elif '-' in date_str:
            date_obj = datetime.fromisoformat(date_str.split('T')[0])
        else:
            return None, None
        
        month_str = date_obj.strftime('%Y-%m')
        
        if date_obj.month >= 4:
            fy = f"{date_obj.year}-{str(date_obj.year + 1)[-2:]}"
        else:
            fy = f"{date_obj.year - 1}-{str(date_obj.year)[-2:]}"
        
        return month_str, fy
    except:
        return None, None

async def check_duplicate_invoice(user_id: str, invoice_no: str, invoice_id: Optional[str] = None) -> tuple:
    """Check if invoice number already exists"""
    query = {
        "user_id": user_id,
        "extracted_data.invoice_no": invoice_no
    }
    if invoice_id:
        query["id"] = {"$ne": invoice_id}
    
    duplicates = await db.invoices.find(query, {"_id": 0, "id": 1}).to_list(100)
    is_duplicate = len(duplicates) > 0
    duplicate_ids = [inv['id'] for inv in duplicates]
    
    return is_duplicate, duplicate_ids

async def validate_gst_number(user_id: str, invoice_type: str, extracted_data: InvoiceData) -> tuple[bool, str]:
    """Validate GST number against company settings - returns (is_valid, error_message)"""
    settings = await db.company_settings.find_one({"user_id": user_id}, {"_id": 0})
    
    if not settings or not settings.get('company_gst_no'):
        return False, "Company GST number not configured. Please update Settings first."
    
    company_gst = settings['company_gst_no'].upper().strip()
    
    if invoice_type == "purchase":
        # For purchase invoices: Bill To GST (buyer) should be our company GST
        bill_to_gst = (extracted_data.buyer_gst_no or extracted_data.gst_no or "").upper().strip()
        if not bill_to_gst:
            return False, "Bill To GST number not found in invoice"
        if bill_to_gst != company_gst:
            return False, f"Invalid Purchase Invoice: Bill To GST ({bill_to_gst}) does not match company GST ({company_gst})"
        return True, ""
    else:  # sales
        # For sales invoices: Bill From GST (supplier) should be our company GST
        bill_from_gst = (extracted_data.supplier_gst_no or "").upper().strip()
        if not bill_from_gst:
            return False, "Bill From GST number not found in invoice"
        if bill_from_gst != company_gst:
            return False, f"Invalid Sales Invoice: Bill From GST ({bill_from_gst}) does not match company GST ({company_gst})"
        return True, ""

async def extract_invoice_data(file_data: bytes, filename: str, invoice_type: str = "purchase") -> tuple[InvoiceData, ConfidenceScores]:
    """Extract invoice data using AI"""
    try:
        llm_key = os.environ.get('EMERGENT_LLM_KEY')
        if not llm_key:
            raise ValueError("EMERGENT_LLM_KEY not found")

        chat = LlmChat(
            api_key=llm_key,
            session_id=str(uuid.uuid4()),
            system_message=f"You are an expert invoice data extraction assistant for {'purchase' if invoice_type == 'purchase' else 'sales'} invoices. Extract structured data accurately."
        ).with_model("gemini", "gemini-2.5-flash")

        temp_file = f"/tmp/{uuid.uuid4()}_{filename}"
        with open(temp_file, "wb") as f:
            f.write(file_data)

        if filename.lower().endswith('.pdf'):
            mime_type = "application/pdf"
        elif filename.lower().endswith(('.jpg', '.jpeg')):
            mime_type = "image/jpeg"
        elif filename.lower().endswith('.png'):
            mime_type = "image/png"
        else:
            mime_type = "application/octet-stream"

        file_content = FileContentWithMimeType(
            file_path=temp_file,
            mime_type=mime_type
        )

        if invoice_type == "purchase":
            prompt = """Extract the following information from this PURCHASE invoice:
            
            CRITICAL: Extract BOTH supplier (Bill From) and buyer (Bill To) details.
            
            - Invoice No
            - Invoice Date (in DD/MM/YYYY format)
            
            **BILL FROM / SUPPLIER DETAILS (Who is selling):**
            - Supplier Name
            - Supplier Address
            - Supplier GST No
            - Supplier Contact Person (if available)
            - Supplier Contact Number (if available)
            
            **BILL TO / BUYER DETAILS (Who is purchasing - the company receiving the invoice):**
            - Buyer Name
            - Buyer Address
            - Buyer GST No (CRITICAL - this should be the purchasing company's GST)
            - Buyer Contact Person (if available)
            - Buyer Contact Number (if available)
            
            **AMOUNTS:**
            - Basic Amount (taxable amount before GST)
            - GST Amount (total GST)
            - Total Amount (final payable amount)
            - GST Rate (percentage like 5, 12, 18, 28)
            - If GST is split, extract: CGST, SGST, IGST amounts
            
            Respond in JSON format with keys: invoice_no, invoice_date, supplier_name, supplier_address, supplier_gst_no, supplier_contact_person, supplier_contact_number, buyer_name, buyer_address, buyer_gst_no, buyer_contact_person, buyer_contact_number, basic_amount, gst, total_amount, gst_rate, cgst, sgst, igst.
            Also include a confidence score (0-100) for each field.
            
            Format:
            {
                "data": {"invoice_no": "...", "invoice_date": "DD/MM/YYYY", "supplier_name": "...", "buyer_name": "...", ...},
                "confidence": {"invoice_no": 95, ...}
            }
            """
        else:
            prompt = """Extract the following information from this SALES invoice:
            
            CRITICAL: Extract BOTH supplier (Bill From - your company) and buyer (Bill To - customer) details.
            
            - Invoice No
            - Invoice Date (in DD/MM/YYYY format)
            
            **BILL FROM / SUPPLIER DETAILS (Your company - who is selling):**
            - Supplier Name (your company name)
            - Supplier Address
            - Supplier GST No (CRITICAL - this should be your company's GST)
            - Supplier Contact Person (if available)
            - Supplier Contact Number (if available)
            
            **BILL TO / BUYER/CUSTOMER DETAILS (Who is purchasing):**
            - Buyer Name (customer name)
            - Buyer Address
            - Buyer GST No
            - Buyer Contact Person (if available)
            - Buyer Contact Number (if available)
            
            **AMOUNTS:**
            - Basic Amount (taxable amount before GST)
            - GST Amount (total GST)
            - Total Amount (final receivable amount)
            - GST Rate (percentage like 5, 12, 18, 28)
            - If GST is split, extract: CGST, SGST, IGST amounts
            
            Respond in JSON format with keys: invoice_no, invoice_date, supplier_name, supplier_address, supplier_gst_no, supplier_contact_person, supplier_contact_number, buyer_name, buyer_address, buyer_gst_no, buyer_contact_person, buyer_contact_number, basic_amount, gst, total_amount, gst_rate, cgst, sgst, igst.
            Also include a confidence score (0-100) for each field.
            
            Format:
            {
                "data": {"invoice_no": "...", "invoice_date": "DD/MM/YYYY", "supplier_name": "...", "buyer_name": "...", ...},
                "confidence": {"invoice_no": 95, ...}
            }
            """

        user_message = UserMessage(
            text=prompt,
            file_contents=[file_content]
        )

        response = await chat.send_message(user_message)
        
        if os.path.exists(temp_file):
            os.remove(temp_file)

        import json
        import re
        response_text = response.strip()
        
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            response_text = json_match.group(0)
        
        result = json.loads(response_text)
        
        data = result.get("data", {})
        confidence = result.get("confidence", {})
        
        invoice_data = InvoiceData(**data)
        confidence_scores = ConfidenceScores(
            invoice_no=confidence.get("invoice_no", 85) / 100,
            invoice_date=confidence.get("invoice_date", 85) / 100,
            supplier_name=confidence.get("supplier_name", 85) / 100,
            address=confidence.get("address", 85) / 100,
            gst_no=confidence.get("gst_no", 85) / 100,
            basic_amount=confidence.get("basic_amount", 85) / 100,
            gst=confidence.get("gst", 85) / 100,
            total_amount=confidence.get("total_amount", 85) / 100
        )
        
        return invoice_data, confidence_scores

    except Exception as e:
        logging.error(f"Error extracting invoice data: {str(e)}")
        logging.error(f"Response was: {response if 'response' in locals() else 'No response'}")
        return InvoiceData(), ConfidenceScores(
            invoice_no=0.5, invoice_date=0.5, supplier_name=0.5, address=0.5,
            gst_no=0.5, basic_amount=0.5, gst=0.5, total_amount=0.5
        )

# Routes
@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    password_hash = bcrypt.hashpw(user_data.password.encode(), bcrypt.gensalt()).decode()
    
    user = User(
        email=user_data.email,
        name=user_data.name
    )
    
    user_dict = user.model_dump()
    user_dict['password_hash'] = password_hash
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    token = create_access_token(user.id, user.email)
    
    return {
        "user": user.model_dump(),
        "token": token
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    password_hash = user_doc.get('password_hash')
    if not bcrypt.checkpw(credentials.password.encode(), password_hash.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user = User(**{k: v for k, v in user_doc.items() if k != 'password_hash'})
    token = create_access_token(user.id, user.email)
    
    return {
        "user": user.model_dump(),
        "token": token
    }

@api_router.get("/settings/company")
async def get_company_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.company_settings.find_one(
        {"user_id": current_user['user_id']},
        {"_id": 0}
    )
    return settings or {}

@api_router.post("/settings/company")
async def update_company_settings(
    settings_data: CompanySettingsUpdate,
    current_user: dict = Depends(get_current_user)
):
    settings = CompanySettings(
        user_id=current_user['user_id'],
        **settings_data.model_dump()
    )
    
    await db.company_settings.update_one(
        {"user_id": current_user['user_id']},
        {"$set": settings.model_dump()},
        upsert=True
    )
    
    return {"message": "Company settings updated successfully"}

@api_router.post("/invoices/upload")
async def upload_invoice(
    file: UploadFile = File(...),
    invoice_type: str = "purchase",
    current_user: dict = Depends(get_current_user)
):
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, and PDF are allowed.")
    
    file_data = await file.read()
    
    extracted_data, confidence_scores = await extract_invoice_data(file_data, file.filename, invoice_type)
    
    month, fy = get_month_and_fy(extracted_data.invoice_date or "")
    
    # Check for duplicates and GST validation
    is_duplicate, duplicate_ids = await check_duplicate_invoice(
        current_user['user_id'],
        extracted_data.invoice_no
    )
    
    gst_mismatch = False
    if extracted_data.gst_no:
        gst_valid = await validate_gst_number(
            current_user['user_id'],
            invoice_type,
            extracted_data.gst_no
        )
        gst_mismatch = not gst_valid
    
    validation_flags = ValidationFlags(
        is_duplicate=is_duplicate,
        gst_mismatch=gst_mismatch,
        duplicate_invoice_ids=duplicate_ids
    )
    
    file_base64 = base64.b64encode(file_data).decode()
    
    invoice = Invoice(
        user_id=current_user['user_id'],
        invoice_type=invoice_type,
        filename=file.filename,
        file_data=file_base64,
        file_type=file.content_type,
        extracted_data=extracted_data,
        confidence_scores=confidence_scores,
        validation_flags=validation_flags,
        month=month,
        financial_year=fy
    )
    
    invoice_dict = invoice.model_dump()
    invoice_dict['created_at'] = invoice_dict['created_at'].isoformat()
    invoice_dict['updated_at'] = invoice_dict['updated_at'].isoformat()
    
    await db.invoices.insert_one(invoice_dict)
    
    return invoice.model_dump()

@api_router.post("/invoices/batch-upload")
async def batch_upload_invoices(
    files: List[UploadFile] = File(...),
    invoice_type: str = "purchase",
    current_user: dict = Depends(get_current_user)
):
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 files allowed per batch")
    
    invoices = []
    successful = 0
    failed = 0
    
    for file in files:
        try:
            allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
            if file.content_type not in allowed_types:
                failed += 1
                continue
            
            file_data = await file.read()
            extracted_data, confidence_scores = await extract_invoice_data(file_data, file.filename, invoice_type)
            month, fy = get_month_and_fy(extracted_data.invoice_date or "")
            
            is_duplicate, duplicate_ids = await check_duplicate_invoice(
                current_user['user_id'],
                extracted_data.invoice_no
            )
            
            gst_mismatch = False
            if extracted_data.gst_no:
                gst_valid = await validate_gst_number(
                    current_user['user_id'],
                    invoice_type,
                    extracted_data.gst_no
                )
                gst_mismatch = not gst_valid
            
            validation_flags = ValidationFlags(
                is_duplicate=is_duplicate,
                gst_mismatch=gst_mismatch,
                duplicate_invoice_ids=duplicate_ids
            )
            
            file_base64 = base64.b64encode(file_data).decode()
            
            invoice = Invoice(
                user_id=current_user['user_id'],
                invoice_type=invoice_type,
                filename=file.filename,
                file_data=file_base64,
                file_type=file.content_type,
                extracted_data=extracted_data,
                confidence_scores=confidence_scores,
                validation_flags=validation_flags,
                month=month,
                financial_year=fy
            )
            
            invoice_dict = invoice.model_dump()
            invoice_dict['created_at'] = invoice_dict['created_at'].isoformat()
            invoice_dict['updated_at'] = invoice_dict['updated_at'].isoformat()
            
            await db.invoices.insert_one(invoice_dict)
            invoices.append(invoice)
            successful += 1
            
        except Exception as e:
            logging.error(f"Error processing {file.filename}: {str(e)}")
            failed += 1
    
    return {
        "total_files": len(files),
        "successful": successful,
        "failed": failed,
        "invoices": [inv.model_dump() for inv in invoices]
    }

@api_router.get("/invoices")
async def get_invoices(
    invoice_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user['user_id']}
    if invoice_type:
        query["invoice_type"] = invoice_type
    
    # Date filter
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        if date_query:
            query["extracted_data.invoice_date"] = date_query
    
    invoices = await db.invoices.find(
        query,
        {"_id": 0, "file_data": 0}
    ).sort("created_at", -1).to_list(1000)
    
    for invoice in invoices:
        if isinstance(invoice['created_at'], str):
            invoice['created_at'] = datetime.fromisoformat(invoice['created_at'])
        if isinstance(invoice['updated_at'], str):
            invoice['updated_at'] = datetime.fromisoformat(invoice['updated_at'])
    
    return invoices

@api_router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    invoice = await db.invoices.find_one(
        {"id": invoice_id, "user_id": current_user['user_id']},
        {"_id": 0}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if isinstance(invoice['created_at'], str):
        invoice['created_at'] = datetime.fromisoformat(invoice['created_at'])
    if isinstance(invoice['updated_at'], str):
        invoice['updated_at'] = datetime.fromisoformat(invoice['updated_at'])
    
    return invoice

@api_router.put("/invoices/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    update_data: InvoiceUpdate,
    current_user: dict = Depends(get_current_user)
):
    invoice = await db.invoices.find_one(
        {"id": invoice_id, "user_id": current_user['user_id']},
        {"_id": 0}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    month, fy = get_month_and_fy(update_data.extracted_data.invoice_date or "")
    
    # Re-check duplicates
    is_duplicate, duplicate_ids = await check_duplicate_invoice(
        current_user['user_id'],
        update_data.extracted_data.invoice_no,
        invoice_id
    )
    
    # Re-check GST
    gst_mismatch = False
    if update_data.extracted_data.gst_no:
        invoice_type = update_data.invoice_type or invoice.get('invoice_type', 'purchase')
        gst_valid = await validate_gst_number(
            current_user['user_id'],
            invoice_type,
            update_data.extracted_data.gst_no
        )
        gst_mismatch = not gst_valid
    
    update_dict = {
        "extracted_data": update_data.extracted_data.model_dump(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "month": month,
        "financial_year": fy,
        "validation_flags.is_duplicate": is_duplicate,
        "validation_flags.gst_mismatch": gst_mismatch,
        "validation_flags.duplicate_invoice_ids": duplicate_ids
    }
    
    if update_data.status:
        update_dict["status"] = update_data.status
    
    if update_data.invoice_type:
        update_dict["invoice_type"] = update_data.invoice_type
    
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": update_dict}
    )
    
    return {"message": "Invoice updated successfully"}

@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.invoices.delete_one(
        {"id": invoice_id, "user_id": current_user['user_id']}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return {"message": "Invoice deleted successfully"}

@api_router.get("/reports/monthly")
async def get_monthly_report(
    month: Optional[str] = None,
    financial_year: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user['user_id'], "status": "verified"}
    
    if month:
        query["month"] = month
    elif financial_year:
        query["financial_year"] = financial_year
    
    invoices = await db.invoices.find(query, {"_id": 0}).to_list(10000)
    
    purchase_invoices = [inv for inv in invoices if inv.get('invoice_type') == 'purchase']
    sales_invoices = [inv for inv in invoices if inv.get('invoice_type') == 'sales']
    
    total_purchase_amount = sum(inv['extracted_data'].get('total_amount', 0) for inv in purchase_invoices)
    total_sales_amount = sum(inv['extracted_data'].get('total_amount', 0) for inv in sales_invoices)
    
    total_purchase_gst = sum(inv['extracted_data'].get('gst', 0) for inv in purchase_invoices)
    total_sales_gst = sum(inv['extracted_data'].get('gst', 0) for inv in sales_invoices)
    
    gst_breakdown = {
        "purchase": {},
        "sales": {}
    }
    
    for inv in purchase_invoices:
        rate = inv['extracted_data'].get('gst_rate', 'unknown')
        if rate not in gst_breakdown['purchase']:
            gst_breakdown['purchase'][rate] = {'count': 0, 'taxable_amount': 0, 'gst_amount': 0}
        gst_breakdown['purchase'][rate]['count'] += 1
        gst_breakdown['purchase'][rate]['taxable_amount'] += inv['extracted_data'].get('basic_amount', 0)
        gst_breakdown['purchase'][rate]['gst_amount'] += inv['extracted_data'].get('gst', 0)
    
    for inv in sales_invoices:
        rate = inv['extracted_data'].get('gst_rate', 'unknown')
        if rate not in gst_breakdown['sales']:
            gst_breakdown['sales'][rate] = {'count': 0, 'taxable_amount': 0, 'gst_amount': 0}
        gst_breakdown['sales'][rate]['count'] += 1
        gst_breakdown['sales'][rate]['taxable_amount'] += inv['extracted_data'].get('basic_amount', 0)
        gst_breakdown['sales'][rate]['gst_amount'] += inv['extracted_data'].get('gst', 0)
    
    net_gst_payable = total_sales_gst - total_purchase_gst
    
    return {
        "period": month or financial_year or "all",
        "purchase_invoices": len(purchase_invoices),
        "sales_invoices": len(sales_invoices),
        "total_purchase_amount": round(total_purchase_amount, 2),
        "total_sales_amount": round(total_sales_amount, 2),
        "total_purchase_gst": round(total_purchase_gst, 2),
        "total_sales_gst": round(total_sales_gst, 2),
        "net_gst_payable": round(net_gst_payable, 2),
        "gst_breakdown": gst_breakdown
    }

@api_router.get("/reports/months")
async def get_available_months(current_user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": current_user['user_id'], "month": {"$ne": None}}},
        {"$group": {"_id": "$month"}},
        {"$sort": {"_id": -1}}
    ]
    
    result = await db.invoices.aggregate(pipeline).to_list(100)
    months = [item['_id'] for item in result if item['_id']]
    
    return {"months": months}

@api_router.post("/invoices/export")
async def export_invoices(
    export_request: ExportRequest,
    current_user: dict = Depends(get_current_user)
):
    invoices = await db.invoices.find(
        {"id": {"$in": export_request.invoice_ids}, "user_id": current_user['user_id']},
        {"_id": 0}
    ).to_list(1000)
    
    if export_request.format == "tally":
        xml_data = generate_tally_xml(invoices)
        return {"format": "tally", "data": xml_data}
    elif export_request.format == "csv":
        csv_data = generate_csv(invoices)
        return {"format": "csv", "data": csv_data}
    else:
        return {"format": "json", "data": invoices}

def generate_tally_xml(invoices: List[Dict]) -> str:
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<ENVELOPE>\n'
    xml += '  <HEADER>\n'
    xml += '    <TALLYREQUEST>Import Data</TALLYREQUEST>\n'
    xml += '  </HEADER>\n'
    xml += '  <BODY>\n'
    xml += '    <IMPORTDATA>\n'
    xml += '      <REQUESTDESC>\n'
    xml += '        <REPORTNAME>Vouchers</REPORTNAME>\n'
    xml += '      </REQUESTDESC>\n'
    xml += '      <REQUESTDATA>\n'
    
    for invoice in invoices:
        data = invoice['extracted_data']
        inv_type = invoice.get('invoice_type', 'purchase')
        xml += '        <TALLYMESSAGE>\n'
        xml += '          <VOUCHER>\n'
        xml += f'            <DATE>{data.get("invoice_date", "")}</DATE>\n'
        xml += f'            <VOUCHERTYPENAME>{"Purchase" if inv_type == "purchase" else "Sales"}</VOUCHERTYPENAME>\n'
        xml += f'            <VOUCHERNUMBER>{data.get("invoice_no", "")}</VOUCHERNUMBER>\n'
        xml += f'            <PARTYLEDGERNAME>{data.get("supplier_name", "")}</PARTYLEDGERNAME>\n'
        xml += f'            <AMOUNT>{data.get("total_amount", 0)}</AMOUNT>\n'
        xml += '          </VOUCHER>\n'
        xml += '        </TALLYMESSAGE>\n'
    
    xml += '      </REQUESTDATA>\n'
    xml += '    </IMPORTDATA>\n'
    xml += '  </BODY>\n'
    xml += '</ENVELOPE>'
    
    return xml

def generate_csv(invoices: List[Dict]) -> str:
    csv = "Type,Invoice No,Invoice Date,Party Name,Contact Person,Contact Number,Address,GST No,Basic Amount,GST,Total Amount,Status\n"
    
    for invoice in invoices:
        data = invoice['extracted_data']
        inv_type = invoice.get('invoice_type', 'purchase')
        csv += f"{inv_type.capitalize()},"
        csv += f"{data.get('invoice_no', '')},"
        csv += f"{data.get('invoice_date', '')},"
        csv += f"{data.get('supplier_name', '')},"
        csv += f"{data.get('contact_person', '')},"
        csv += f"{data.get('contact_number', '')},"
        csv += f"\"{data.get('address', '')}\","
        csv += f"{data.get('gst_no', '')},"
        csv += f"{data.get('basic_amount', '')},"
        csv += f"{data.get('gst', '')},"
        csv += f"{data.get('total_amount', '')},"
        csv += f"{invoice.get('status', '')}\n"
    
    return csv

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()