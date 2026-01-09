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
import base64
import io
from pypdf import PdfReader
import asyncio
import pandas as pd
import json
import re

# LLM imports - using standard SDKs (OpenAI and Google)
try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

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
    role: str = "user"  # "user" or "admin"
    is_active: bool = True  # Enable/disable user access
    subscription_valid_until: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CompanySettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    company_name: str
    company_gst_no: str
    company_logo: Optional[str] = None  # Base64 encoded logo
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_number: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CompanySettingsUpdate(BaseModel):
    company_name: str
    company_gst_no: str
    company_logo: Optional[str] = None
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

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

class AdminUserUpdate(BaseModel):
    is_active: Optional[bool] = None  # Enable/disable user access
    subscription_valid_until: Optional[str] = None  # ISO date string

class AdminPasswordReset(BaseModel):
    new_password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ManualInvoiceCreate(BaseModel):
    invoice_type: str
    original_filename: str
    extracted_data: dict
    confidence_scores: dict = {}
    status: str = "verified"
    is_manual_entry: bool = True

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    subscription_valid_until: Optional[str] = None
    created_at: str

class BankTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: Optional[str] = None
    description: str
    credit: Optional[float] = None
    debit: Optional[float] = None
    balance: Optional[float] = None
    party_name: Optional[str] = None
    reference_no: Optional[str] = None

class BankStatement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    filename: str
    upload_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    transactions: List[Dict[str, Any]] = []
    total_credits: float = 0
    total_debits: float = 0
    account_info: Optional[Dict[str, Any]] = None

class OutstandingReport(BaseModel):
    buyer_name: str
    buyer_gst: Optional[str] = None
    total_sales: float = 0
    total_received: float = 0
    outstanding: float = 0
    invoices: List[Dict[str, Any]] = []
    payments: List[Dict[str, Any]] = []

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
    
    # Check if user is disabled
    if not user_doc.get('is_active', True):
        raise HTTPException(status_code=403, detail="Your account has been disabled. Please contact administrator.")
    
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

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """
    Send password reset link to user's email.
    NOTE: In production, this would send an actual email with a reset link.
    For now, it just confirms the email exists.
    """
    user = await db.users.find_one({"email": request.email})
    if not user:
        # Don't reveal if email exists or not for security
        return {"message": "If this email is registered, you will receive a password reset link."}
    
    # In production, generate reset token and send email
    # For now, just acknowledge the request
    logging.info(f"Password reset requested for: {request.email}")
    
    return {"message": "If this email is registered, you will receive a password reset link."}

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
    
    # Check for duplicate invoice number - BLOCK if duplicate found
    if extracted_data.invoice_no:
        is_duplicate, duplicate_ids = await check_duplicate_invoice(
            current_user['user_id'],
            extracted_data.invoice_no
        )
        if is_duplicate:
            raise HTTPException(
                status_code=400, 
                detail=f"Duplicate Invoice Number: Invoice #{extracted_data.invoice_no} already exists in the system (ID: {duplicate_ids[0]}). Please check existing invoices."
            )
    
    # Validate GST number - BLOCK if invalid
    gst_valid, error_message = await validate_gst_number(
        current_user['user_id'],
        invoice_type,
        extracted_data
    )
    
    if not gst_valid:
        raise HTTPException(status_code=400, detail=error_message)
    
    month, fy = get_month_and_fy(extracted_data.invoice_date or "")
    
    # All validations passed
    validation_flags = ValidationFlags(
        is_duplicate=False,
        gst_mismatch=False,
        duplicate_invoice_ids=[]
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
    errors = []
    
    for file in files:
        try:
            allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
            if file.content_type not in allowed_types:
                failed += 1
                errors.append(f"{file.filename}: Invalid file type")
                continue
            
            file_data = await file.read()
            extracted_data, confidence_scores = await extract_invoice_data(file_data, file.filename, invoice_type)
            month, fy = get_month_and_fy(extracted_data.invoice_date or "")
            
            # Check for duplicates - SKIP if duplicate
            if extracted_data.invoice_no:
                is_duplicate, duplicate_ids = await check_duplicate_invoice(
                    current_user['user_id'],
                    extracted_data.invoice_no
                )
                if is_duplicate:
                    failed += 1
                    errors.append(f"{file.filename}: Duplicate invoice #{extracted_data.invoice_no}")
                    continue
            
            # Validate GST - SKIP if invalid
            gst_valid, error_message = await validate_gst_number(
                current_user['user_id'],
                invoice_type,
                extracted_data
            )
            if not gst_valid:
                failed += 1
                errors.append(f"{file.filename}: {error_message}")
                continue
            
            validation_flags = ValidationFlags(
                is_duplicate=False,
                gst_mismatch=False,
                duplicate_invoice_ids=[]
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
            errors.append(f"{file.filename}: {str(e)}")
    
    return {
        "total_files": len(files),
        "successful": successful,
        "failed": failed,
        "invoices": [inv.model_dump() for inv in invoices],
        "errors": errors
    }

@api_router.post("/invoices/manual")
async def create_manual_invoice(
    invoice_data: ManualInvoiceCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a manual invoice entry for handwritten or unreadable invoices"""
    
    # Check for duplicate invoice number
    invoice_no = invoice_data.extracted_data.get('invoice_no')
    if invoice_no:
        is_duplicate, duplicate_ids = await check_duplicate_invoice(
            current_user['user_id'],
            invoice_no
        )
        if is_duplicate:
            raise HTTPException(
                status_code=400,
                detail=f"Duplicate Invoice Number: Invoice #{invoice_no} already exists in the system (ID: {duplicate_ids[0]}). Please check existing invoices."
            )
    
    # Extract date info for month/FY
    invoice_date = invoice_data.extracted_data.get('invoice_date', '')
    month, fy = get_month_and_fy(invoice_date)
    
    # Create extracted data object
    extracted_data = InvoiceData(
        invoice_no=invoice_data.extracted_data.get('invoice_no', ''),
        invoice_date=invoice_data.extracted_data.get('invoice_date', ''),
        bill_to_name=invoice_data.extracted_data.get('bill_to_name', ''),
        bill_to_gst=invoice_data.extracted_data.get('bill_to_gst', ''),
        bill_to_address=invoice_data.extracted_data.get('bill_to_address', ''),
        supplier_name=invoice_data.extracted_data.get('supplier_name', ''),
        supplier_gst=invoice_data.extracted_data.get('supplier_gst', ''),
        supplier_address=invoice_data.extracted_data.get('supplier_address', ''),
        basic_amount=invoice_data.extracted_data.get('basic_amount', 0),
        gst=invoice_data.extracted_data.get('gst', 0),
        total_amount=invoice_data.extracted_data.get('total_amount', 0)
    )
    
    # Validation flags for manual entry (assume clean)
    validation_flags = ValidationFlags(
        is_duplicate=False,
        gst_mismatch=False,
        duplicate_invoice_ids=[]
    )
    
    # Create invoice object
    invoice = Invoice(
        user_id=current_user['user_id'],
        invoice_type=invoice_data.invoice_type,
        filename=invoice_data.original_filename,
        file_data="",  # No file for manual entry
        file_type="manual",
        extracted_data=extracted_data,
        confidence_scores={},
        validation_flags=validation_flags,
        status="verified",  # Manual entries are pre-verified
        month=month,
        financial_year=fy
    )
    
    invoice_dict = invoice.model_dump()
    invoice_dict['created_at'] = invoice_dict['created_at'].isoformat()
    invoice_dict['updated_at'] = invoice_dict['updated_at'].isoformat()
    invoice_dict['is_manual_entry'] = True
    
    await db.invoices.insert_one(invoice_dict)
    
    return invoice.model_dump()

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
    
    # Re-check GST - but don't block update, just flag
    gst_mismatch = False
    invoice_type = update_data.invoice_type or invoice.get('invoice_type', 'purchase')
    
    # Try to validate GST, but don't fail if validation fails
    try:
        gst_valid, _ = await validate_gst_number(
            current_user['user_id'],
            invoice_type,
            update_data.extracted_data
        )
        gst_mismatch = not gst_valid
    except:
        # If validation fails (e.g., no company settings), just mark as no mismatch
        gst_mismatch = False
    
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

@api_router.delete("/invoices")
async def delete_all_invoices(current_user: dict = Depends(get_current_user)):
    """Delete all invoices for the current user"""
    result = await db.invoices.delete_many(
        {"user_id": current_user['user_id']}
    )
    
    return {
        "message": f"Successfully deleted {result.deleted_count} invoice(s)",
        "deleted_count": result.deleted_count
    }

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

# ============= Bank Reconciliation Endpoints =============

@api_router.post("/bank-statement/upload")
async def upload_bank_statement(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload bank statement (PDF or Excel) and extract transactions using AI"""
    
    # Validate file type
    filename = file.filename.lower()
    if not (filename.endswith('.pdf') or filename.endswith('.xlsx') or filename.endswith('.xls') or filename.endswith('.csv')):
        raise HTTPException(status_code=400, detail="Only PDF, Excel (.xlsx, .xls) and CSV files are supported")
    
    content = await file.read()
    
    # Extract text based on file type
    extracted_text = ""
    
    if filename.endswith('.pdf'):
        # Extract text from PDF
        try:
            pdf_reader = PdfReader(io.BytesIO(content))
            for page in pdf_reader.pages:
                extracted_text += page.extract_text() + "\n"
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read PDF: {str(e)}")
    
    elif filename.endswith('.csv'):
        # Read CSV content directly
        try:
            extracted_text = content.decode('utf-8')
        except:
            extracted_text = content.decode('latin-1')
    
    elif filename.endswith(('.xlsx', '.xls')):
        # Convert Excel to text using pandas
        try:
            df = pd.read_excel(io.BytesIO(content))
            # Convert dataframe to CSV-like text
            extracted_text = df.to_csv(index=False)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {str(e)}")
    
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format")
    
    # Use AI to extract transactions with retry logic
    llm_key = os.environ.get("EMERGENT_LLM_KEY")
    if not llm_key:
        llm_key = os.environ.get("EMERGENT_API_KEY")
    if not llm_key:
        raise HTTPException(status_code=500, detail="LLM API key not configured")
    
    extraction_prompt = """Analyze this bank statement and extract all transactions. 
    
For each transaction, extract:
- date: Transaction date (format as YYYY-MM-DD if possible)
- description: Full description/narration
- credit: Amount credited (incoming payment) - as number only
- debit: Amount debited (outgoing payment) - as number only  
- balance: Running balance after transaction - as number only
- party_name: Try to identify the party name from the description (person/company who paid or received)
- reference_no: Any reference/UTR/cheque number

Return a JSON object with this structure:
{
    "account_info": {
        "account_number": "if found",
        "bank_name": "if found",
        "account_holder": "if found",
        "statement_period": "if found"
    },
    "transactions": [
        {
            "date": "2024-01-15",
            "description": "NEFT FROM ABC COMPANY",
            "credit": 50000,
            "debit": null,
            "balance": 150000,
            "party_name": "ABC COMPANY",
            "reference_no": "NEFT123456"
        }
    ],
    "summary": {
        "total_credits": 100000,
        "total_debits": 50000,
        "opening_balance": 100000,
        "closing_balance": 150000
    }
}

IMPORTANT: 
- Return ONLY valid JSON, no explanations
- For credit/debit/balance, use numbers only (no currency symbols)
- If a field is not found, use null
- Try to identify party names from NEFT/IMPS/UPI descriptions
"""
    
    # Try different models if one fails
    models_to_try = [
        ("gemini", "gemini-2.5-flash"),
        ("gemini", "gemini-2.0-flash"),
        ("openai", "gpt-4o-mini"),
    ]
    
    last_error = None
    response = None
    
    for provider, model in models_to_try:
        try:
            chat = LlmChat(
                api_key=llm_key,
                session_id=str(uuid.uuid4()),
                system_message="You are an expert bank statement data extraction assistant. Extract transaction data accurately from any bank statement format."
            ).with_model(provider, model)
            
            if provider == "gemini":
                # Gemini supports file attachments
                temp_file = f"/tmp/{uuid.uuid4()}_statement.txt"
                with open(temp_file, "w") as f:
                    f.write(extracted_text)
                
                file_content = FileContentWithMimeType(
                    file_path=temp_file,
                    mime_type="text/plain"
                )
                
                user_message = UserMessage(
                    text=extraction_prompt,
                    file_contents=[file_content]
                )
                
                response = await chat.send_message(user_message)
                
                # Clean up temp file
                try:
                    os.remove(temp_file)
                except:
                    pass
            else:
                # OpenAI - send text directly in the prompt
                full_prompt = f"{extraction_prompt}\n\nBank Statement Data:\n{extracted_text[:30000]}"
                user_message = UserMessage(text=full_prompt)
                response = await chat.send_message(user_message)
            
            if response:
                logging.info(f"Successfully used {provider}/{model} for bank statement extraction")
                break
        except Exception as e:
            last_error = str(e)
            logging.warning(f"Failed with {provider}/{model}: {str(e)}, trying next model...")
            continue
    
    if response is None:
        raise HTTPException(status_code=500, detail=f"All AI models failed. Last error: {last_error}")
    
    try:
        # Parse AI response
        response_text = response.strip() if isinstance(response, str) else str(response)
        
        # Remove markdown code blocks
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            parts = response_text.split("```")
            if len(parts) >= 2:
                response_text = parts[1]
        
        # Try to find JSON object in the response
        import json
        import re
        
        # Clean up common JSON issues
        response_text = response_text.strip()
        
        # Try to extract just the JSON object
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            response_text = json_match.group(0)
        
        # Fix common JSON errors
        # Remove trailing commas before ] or }
        response_text = re.sub(r',(\s*[}\]])', r'\1', response_text)
        # Fix unquoted keys (simple cases)
        response_text = re.sub(r'(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', response_text)
        
        try:
            extracted_data = json.loads(response_text.strip())
        except json.JSONDecodeError as je:
            # If JSON parsing fails, try to extract transactions manually
            logging.warning(f"JSON parse error: {str(je)}, attempting manual extraction")
            
            # Create a minimal valid response
            extracted_data = {
                "account_info": {},
                "transactions": [],
                "summary": {
                    "total_credits": 0,
                    "total_debits": 0
                }
            }
            
            # Try to find transactions array - handle multi-line
            trans_start = response_text.find('"transactions"')
            if trans_start != -1:
                # Find the opening bracket
                bracket_start = response_text.find('[', trans_start)
                if bracket_start != -1:
                    # Find matching closing bracket
                    bracket_count = 1
                    bracket_end = bracket_start + 1
                    while bracket_count > 0 and bracket_end < len(response_text):
                        if response_text[bracket_end] == '[':
                            bracket_count += 1
                        elif response_text[bracket_end] == ']':
                            bracket_count -= 1
                        bracket_end += 1
                    
                    trans_text = response_text[bracket_start+1:bracket_end-1]
                    
                    # Find all transaction objects using balanced brace matching
                    i = 0
                    while i < len(trans_text):
                        if trans_text[i] == '{':
                            brace_count = 1
                            start = i
                            i += 1
                            while brace_count > 0 and i < len(trans_text):
                                if trans_text[i] == '{':
                                    brace_count += 1
                                elif trans_text[i] == '}':
                                    brace_count -= 1
                                i += 1
                            
                            t_obj = trans_text[start:i]
                            try:
                                # Clean up the transaction object
                                t_obj_clean = re.sub(r',(\s*[}\]])', r'\1', t_obj)
                                t_obj_clean = re.sub(r'(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', t_obj_clean)
                                trans = json.loads(t_obj_clean)
                                extracted_data["transactions"].append(trans)
                            except Exception as te:
                                logging.debug(f"Failed to parse transaction: {te}")
                                continue
                        else:
                            i += 1
            
            # Calculate totals from extracted transactions
            for t in extracted_data["transactions"]:
                try:
                    credit = t.get("credit")
                    if credit and str(credit).replace('.','').replace('-','').isdigit():
                        extracted_data["summary"]["total_credits"] += float(credit)
                except:
                    pass
                try:
                    debit = t.get("debit")
                    if debit and str(debit).replace('.','').replace('-','').isdigit():
                        extracted_data["summary"]["total_debits"] += float(debit)
                except:
                    pass
            
            logging.info(f"Manual extraction found {len(extracted_data['transactions'])} transactions")
        
    except Exception as e:
        logging.error(f"AI extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to extract transactions: {str(e)}")
    
    # Store the bank statement
    bank_statement = {
        "id": str(uuid.uuid4()),
        "user_id": current_user['user_id'],
        "filename": file.filename,
        "upload_date": datetime.now(timezone.utc).isoformat(),
        "transactions": extracted_data.get('transactions', []),
        "total_credits": extracted_data.get('summary', {}).get('total_credits', 0) or 0,
        "total_debits": extracted_data.get('summary', {}).get('total_debits', 0) or 0,
        "account_info": extracted_data.get('account_info', {})
    }
    
    await db.bank_statements.insert_one(bank_statement)
    
    # Remove _id for response
    bank_statement.pop('_id', None)
    
    return {
        "message": "Bank statement uploaded and processed successfully",
        "statement_id": bank_statement['id'],
        "transactions_count": len(bank_statement['transactions']),
        "total_credits": bank_statement['total_credits'],
        "total_debits": bank_statement['total_debits'],
        "account_info": bank_statement['account_info']
    }

@api_router.get("/bank-statement/list")
async def list_bank_statements(current_user: dict = Depends(get_current_user)):
    """Get all uploaded bank statements for current user"""
    statements = await db.bank_statements.find(
        {"user_id": current_user['user_id']},
        {"_id": 0, "transactions": 0}
    ).sort("upload_date", -1).to_list(100)
    
    return statements

@api_router.get("/bank-statement/{statement_id}")
async def get_bank_statement(statement_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific bank statement with transactions"""
    statement = await db.bank_statements.find_one(
        {"id": statement_id, "user_id": current_user['user_id']},
        {"_id": 0}
    )
    
    if not statement:
        raise HTTPException(status_code=404, detail="Bank statement not found")
    
    return statement

@api_router.get("/bank-statement/{statement_id}/transactions")
async def get_bank_statement_transactions(statement_id: str, current_user: dict = Depends(get_current_user)):
    """Get transactions from a bank statement with buyer mapping info"""
    statement = await db.bank_statements.find_one(
        {"id": statement_id, "user_id": current_user['user_id']},
        {"_id": 0}
    )
    
    if not statement:
        raise HTTPException(status_code=404, detail="Bank statement not found")
    
    # Get all buyers from sales invoices
    sales_invoices = await db.invoices.find(
        {"user_id": current_user['user_id'], "invoice_type": "sales"},
        {"_id": 0}
    ).to_list(10000)
    
    buyers = {}
    for invoice in sales_invoices:
        ext_data = invoice.get('extracted_data', {})
        buyer_name = ext_data.get('bill_to_name') or ext_data.get('buyer_name')
        if buyer_name:
            buyer_name = buyer_name.strip()
            if buyer_name not in buyers:
                buyers[buyer_name] = {
                    "name": buyer_name,
                    "gst": ext_data.get('bill_to_gst') or ext_data.get('buyer_gst')
                }
    
    # Get manual mappings
    mappings = await db.bank_transaction_mappings.find(
        {"user_id": current_user['user_id'], "statement_id": statement_id},
        {"_id": 0}
    ).to_list(10000)
    
    mapping_dict = {m['transaction_index']: m['buyer_name'] for m in mappings}
    
    # Add mapping info to transactions
    transactions = []
    for idx, txn in enumerate(statement.get('transactions', [])):
        txn_with_mapping = {
            **txn,
            "index": idx,
            "mapped_buyer": mapping_dict.get(idx)
        }
        transactions.append(txn_with_mapping)
    
    return {
        "statement_id": statement_id,
        "filename": statement.get('filename'),
        "transactions": transactions,
        "buyers": list(buyers.values())
    }

@api_router.post("/bank-statement/map-transaction")
async def map_transaction_to_buyer(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Manually map a bank transaction to a buyer"""
    statement_id = data.get('statement_id')
    transaction_index = data.get('transaction_index')
    buyer_name = data.get('buyer_name')  # Can be None to unmap
    
    if statement_id is None or transaction_index is None:
        raise HTTPException(status_code=400, detail="statement_id and transaction_index are required")
    
    # Verify statement belongs to user
    statement = await db.bank_statements.find_one(
        {"id": statement_id, "user_id": current_user['user_id']},
        {"_id": 0}
    )
    
    if not statement:
        raise HTTPException(status_code=404, detail="Bank statement not found")
    
    if buyer_name:
        # Create or update mapping
        await db.bank_transaction_mappings.update_one(
            {
                "user_id": current_user['user_id'],
                "statement_id": statement_id,
                "transaction_index": transaction_index
            },
            {
                "$set": {
                    "user_id": current_user['user_id'],
                    "statement_id": statement_id,
                    "transaction_index": transaction_index,
                    "buyer_name": buyer_name,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        return {"message": f"Transaction mapped to {buyer_name}"}
    else:
        # Remove mapping
        await db.bank_transaction_mappings.delete_one({
            "user_id": current_user['user_id'],
            "statement_id": statement_id,
            "transaction_index": transaction_index
        })
        return {"message": "Transaction mapping removed"}

@api_router.delete("/bank-statement/{statement_id}")
async def delete_bank_statement(statement_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a bank statement"""
    result = await db.bank_statements.delete_one(
        {"id": statement_id, "user_id": current_user['user_id']}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bank statement not found")
    
    # Also delete mappings for this statement
    await db.bank_transaction_mappings.delete_many({
        "user_id": current_user['user_id'],
        "statement_id": statement_id
    })
    
    return {"message": "Bank statement deleted successfully"}

@api_router.get("/bank-reconciliation/outstanding")
async def get_outstanding_report(current_user: dict = Depends(get_current_user)):
    """Generate outstanding report by matching invoices with bank payments using fuzzy matching and manual mappings"""
    from fuzzywuzzy import fuzz
    
    # Get all sales invoices for the user
    sales_invoices = await db.invoices.find(
        {"user_id": current_user['user_id'], "invoice_type": "sales"},
        {"_id": 0}
    ).to_list(10000)
    
    # Get all bank statements and their transactions
    bank_statements = await db.bank_statements.find(
        {"user_id": current_user['user_id']},
        {"_id": 0}
    ).to_list(100)
    
    # Get all manual mappings
    manual_mappings = await db.bank_transaction_mappings.find(
        {"user_id": current_user['user_id']},
        {"_id": 0}
    ).to_list(10000)
    
    # Create mapping lookup: {statement_id: {transaction_index: buyer_name}}
    mapping_lookup = {}
    for m in manual_mappings:
        stmt_id = m.get('statement_id')
        txn_idx = m.get('transaction_index')
        if stmt_id not in mapping_lookup:
            mapping_lookup[stmt_id] = {}
        mapping_lookup[stmt_id][txn_idx] = m.get('buyer_name')
    
    # Collect all credit transactions (payments received) with statement info
    all_payments = []
    for statement in bank_statements:
        stmt_id = statement.get('id')
        stmt_mappings = mapping_lookup.get(stmt_id, {})
        
        for idx, txn in enumerate(statement.get('transactions', [])):
            if txn.get('credit') and float(txn['credit'] or 0) > 0:
                txn_with_info = {
                    **txn,
                    "statement_id": stmt_id,
                    "transaction_index": idx,
                    "manual_mapping": stmt_mappings.get(idx)
                }
                all_payments.append(txn_with_info)
    
    # Collect all credit transactions (payments received)
    all_payments = []
    for statement in bank_statements:
        for txn in statement.get('transactions', []):
            if txn.get('credit') and float(txn['credit'] or 0) > 0:
                all_payments.append(txn)
    
    # Group invoices by buyer
    buyer_invoices = {}
    for invoice in sales_invoices:
        ext_data = invoice.get('extracted_data', {})
        buyer_name = ext_data.get('bill_to_name') or ext_data.get('buyer_name') or 'Unknown Buyer'
        buyer_name = buyer_name.strip().upper()
        
        if buyer_name not in buyer_invoices:
            buyer_invoices[buyer_name] = {
                "buyer_name": buyer_name,
                "buyer_gst": ext_data.get('bill_to_gst') or ext_data.get('buyer_gst'),
                "total_sales": 0,
                "invoices": []
            }
        
        amount = float(ext_data.get('total_amount') or 0)
        buyer_invoices[buyer_name]['total_sales'] += amount
        buyer_invoices[buyer_name]['invoices'].append({
            "invoice_id": invoice.get('id'),
            "invoice_no": ext_data.get('invoice_no'),
            "invoice_date": ext_data.get('invoice_date'),
            "amount": amount
        })
    
    # Helper function for fuzzy matching
    def find_best_buyer_match(payment_text, buyer_names, threshold=60):
        """Find the best matching buyer name using fuzzy matching"""
        payment_text = payment_text.upper()
        best_match = None
        best_score = 0
        
        for buyer_name in buyer_names:
            # Try different matching strategies
            
            # 1. Direct partial match
            score1 = fuzz.partial_ratio(buyer_name, payment_text)
            
            # 2. Token set ratio (handles word order differences)
            score2 = fuzz.token_set_ratio(buyer_name, payment_text)
            
            # 3. Check if significant words match
            buyer_words = [w for w in buyer_name.split() if len(w) > 3]
            word_matches = sum(1 for w in buyer_words if w in payment_text)
            word_score = (word_matches / len(buyer_words) * 100) if buyer_words else 0
            
            # Take the best score from all strategies
            score = max(score1, score2, word_score)
            
            if score > best_score and score >= threshold:
                best_score = score
                best_match = buyer_name
        
        return best_match, best_score
    
    # Match payments with buyers using fuzzy matching
    buyer_payments = {name: {"payments": [], "total_received": 0} for name in buyer_invoices.keys()}
    unmatched_payments = []
    
    buyer_names = list(buyer_invoices.keys())
    
    for payment in all_payments:
        # Check for manual mapping first
        manual_buyer = payment.get('manual_mapping')
        
        if manual_buyer and manual_buyer.upper() in buyer_invoices:
            # Use manual mapping
            matched_buyer = manual_buyer.upper()
            payment_with_match = {**payment, "match_score": 100, "match_type": "manual"}
            buyer_payments[matched_buyer]['payments'].append(payment_with_match)
            buyer_payments[matched_buyer]['total_received'] += float(payment.get('credit', 0) or 0)
        else:
            # Try fuzzy matching
            party_name = (payment.get('party_name') or '').strip()
            description = (payment.get('description') or '').strip()
            
            # Combine party name and description for matching
            payment_text = f"{party_name} {description}"
            
            # Find best matching buyer
            matched_buyer, match_score = find_best_buyer_match(payment_text, buyer_names)
            
            if matched_buyer:
                payment_with_match = {**payment, "match_score": match_score, "match_type": "auto", "matched_text": payment_text[:100]}
                buyer_payments[matched_buyer]['payments'].append(payment_with_match)
                buyer_payments[matched_buyer]['total_received'] += float(payment.get('credit', 0) or 0)
            else:
                unmatched_payments.append({**payment, "search_text": payment_text[:100]})
    
    # Build outstanding report
    outstanding_report = []
    for buyer_name, data in buyer_invoices.items():
        total_received = buyer_payments.get(buyer_name, {}).get('total_received', 0)
        payments = buyer_payments.get(buyer_name, {}).get('payments', [])
        
        outstanding_report.append({
            "buyer_name": buyer_name,
            "buyer_gst": data.get('buyer_gst'),
            "total_sales": round(data['total_sales'], 2),
            "total_received": round(total_received, 2),
            "outstanding": round(data['total_sales'] - total_received, 2),
            "invoice_count": len(data['invoices']),
            "invoices": data['invoices'],
            "payments": payments,
            "payment_count": len(payments)
        })
    
    # Sort by outstanding amount (highest first)
    outstanding_report.sort(key=lambda x: x['outstanding'], reverse=True)
    
    # Calculate totals
    total_sales = sum(r['total_sales'] for r in outstanding_report)
    total_received = sum(r['total_received'] for r in outstanding_report)
    total_outstanding = sum(r['outstanding'] for r in outstanding_report)
    
    return {
        "summary": {
            "total_sales": round(total_sales, 2),
            "total_received": round(total_received, 2),
            "total_outstanding": round(total_outstanding, 2),
            "buyer_count": len(outstanding_report),
            "unmatched_payments_count": len(unmatched_payments),
            "total_payments": len(all_payments)
        },
        "buyers": outstanding_report,
        "unmatched_payments": unmatched_payments
    }

@api_router.get("/bank-reconciliation/payables")
async def get_payables_report(current_user: dict = Depends(get_current_user)):
    """Generate payables report - how much we paid for purchase invoices"""
    from fuzzywuzzy import fuzz
    
    # Get all purchase invoices for the user
    purchase_invoices = await db.invoices.find(
        {"user_id": current_user['user_id'], "invoice_type": "purchase"},
        {"_id": 0}
    ).to_list(10000)
    
    # Get all bank statements and their transactions
    bank_statements = await db.bank_statements.find(
        {"user_id": current_user['user_id']},
        {"_id": 0}
    ).to_list(100)
    
    # Get all manual mappings for payables
    manual_mappings = await db.bank_payable_mappings.find(
        {"user_id": current_user['user_id']},
        {"_id": 0}
    ).to_list(10000)
    
    # Create mapping lookup
    mapping_lookup = {}
    for m in manual_mappings:
        stmt_id = m.get('statement_id')
        txn_idx = m.get('transaction_index')
        if stmt_id not in mapping_lookup:
            mapping_lookup[stmt_id] = {}
        mapping_lookup[stmt_id][txn_idx] = m.get('supplier_name')
    
    # Collect all debit transactions (payments made)
    all_payments = []
    for statement in bank_statements:
        stmt_id = statement.get('id')
        stmt_mappings = mapping_lookup.get(stmt_id, {})
        
        for idx, txn in enumerate(statement.get('transactions', [])):
            if txn.get('debit') and float(txn['debit'] or 0) > 0:
                txn_with_info = {
                    **txn,
                    "statement_id": stmt_id,
                    "transaction_index": idx,
                    "manual_mapping": stmt_mappings.get(idx)
                }
                all_payments.append(txn_with_info)
    
    # Group invoices by supplier
    supplier_invoices = {}
    for invoice in purchase_invoices:
        ext_data = invoice.get('extracted_data', {})
        supplier_name = ext_data.get('supplier_name') or ext_data.get('bill_from_name') or 'Unknown Supplier'
        supplier_name = supplier_name.strip().upper()
        
        if supplier_name not in supplier_invoices:
            supplier_invoices[supplier_name] = {
                "supplier_name": supplier_name,
                "supplier_gst": ext_data.get('supplier_gst') or ext_data.get('bill_from_gst'),
                "total_purchases": 0,
                "invoices": []
            }
        
        amount = float(ext_data.get('total_amount') or 0)
        supplier_invoices[supplier_name]['total_purchases'] += amount
        supplier_invoices[supplier_name]['invoices'].append({
            "invoice_id": invoice.get('id'),
            "invoice_no": ext_data.get('invoice_no'),
            "invoice_date": ext_data.get('invoice_date'),
            "amount": amount
        })
    
    # Helper function for fuzzy matching
    def find_best_supplier_match(payment_text, supplier_names, threshold=60):
        payment_text = payment_text.upper()
        best_match = None
        best_score = 0
        
        for supplier_name in supplier_names:
            score1 = fuzz.partial_ratio(supplier_name, payment_text)
            score2 = fuzz.token_set_ratio(supplier_name, payment_text)
            
            supplier_words = [w for w in supplier_name.split() if len(w) > 3]
            word_matches = sum(1 for w in supplier_words if w in payment_text)
            word_score = (word_matches / len(supplier_words) * 100) if supplier_words else 0
            
            score = max(score1, score2, word_score)
            
            if score > best_score and score >= threshold:
                best_score = score
                best_match = supplier_name
        
        return best_match, best_score
    
    # Match payments with suppliers
    supplier_payments = {name: {"payments": [], "total_paid": 0} for name in supplier_invoices.keys()}
    unmatched_payments = []
    
    supplier_names = list(supplier_invoices.keys())
    
    for payment in all_payments:
        manual_supplier = payment.get('manual_mapping')
        
        if manual_supplier and manual_supplier.upper() in supplier_invoices:
            matched_supplier = manual_supplier.upper()
            payment_with_match = {**payment, "match_score": 100, "match_type": "manual"}
            supplier_payments[matched_supplier]['payments'].append(payment_with_match)
            supplier_payments[matched_supplier]['total_paid'] += float(payment.get('debit', 0) or 0)
        else:
            party_name = (payment.get('party_name') or '').strip()
            description = (payment.get('description') or '').strip()
            payment_text = f"{party_name} {description}"
            
            matched_supplier, match_score = find_best_supplier_match(payment_text, supplier_names)
            
            if matched_supplier:
                payment_with_match = {**payment, "match_score": match_score, "match_type": "auto", "matched_text": payment_text[:100]}
                supplier_payments[matched_supplier]['payments'].append(payment_with_match)
                supplier_payments[matched_supplier]['total_paid'] += float(payment.get('debit', 0) or 0)
            else:
                unmatched_payments.append({**payment, "search_text": payment_text[:100]})
    
    # Build payables report
    payables_report = []
    for supplier_name, data in supplier_invoices.items():
        total_paid = supplier_payments.get(supplier_name, {}).get('total_paid', 0)
        payments = supplier_payments.get(supplier_name, {}).get('payments', [])
        
        payables_report.append({
            "supplier_name": supplier_name,
            "supplier_gst": data.get('supplier_gst'),
            "total_purchases": round(data['total_purchases'], 2),
            "total_paid": round(total_paid, 2),
            "balance_due": round(data['total_purchases'] - total_paid, 2),
            "invoice_count": len(data['invoices']),
            "invoices": data['invoices'],
            "payments": payments,
            "payment_count": len(payments)
        })
    
    payables_report.sort(key=lambda x: x['balance_due'], reverse=True)
    
    total_purchases = sum(r['total_purchases'] for r in payables_report)
    total_paid = sum(r['total_paid'] for r in payables_report)
    total_balance_due = sum(r['balance_due'] for r in payables_report)
    
    return {
        "summary": {
            "total_purchases": round(total_purchases, 2),
            "total_paid": round(total_paid, 2),
            "total_balance_due": round(total_balance_due, 2),
            "supplier_count": len(payables_report),
            "unmatched_payments_count": len(unmatched_payments),
            "total_payments": len(all_payments)
        },
        "suppliers": payables_report,
        "unmatched_payments": unmatched_payments
    }

@api_router.get("/bank-statement/{statement_id}/debit-transactions")
async def get_debit_transactions(statement_id: str, current_user: dict = Depends(get_current_user)):
    """Get debit transactions from a bank statement for supplier mapping"""
    statement = await db.bank_statements.find_one(
        {"id": statement_id, "user_id": current_user['user_id']},
        {"_id": 0}
    )
    
    if not statement:
        raise HTTPException(status_code=404, detail="Bank statement not found")
    
    # Get all suppliers from purchase invoices
    purchase_invoices = await db.invoices.find(
        {"user_id": current_user['user_id'], "invoice_type": "purchase"},
        {"_id": 0}
    ).to_list(10000)
    
    suppliers = {}
    for invoice in purchase_invoices:
        ext_data = invoice.get('extracted_data', {})
        supplier_name = ext_data.get('supplier_name') or ext_data.get('bill_from_name')
        if supplier_name:
            supplier_name = supplier_name.strip()
            if supplier_name not in suppliers:
                suppliers[supplier_name] = {
                    "name": supplier_name,
                    "gst": ext_data.get('supplier_gst') or ext_data.get('bill_from_gst')
                }
    
    # Get manual mappings for payables
    mappings = await db.bank_payable_mappings.find(
        {"user_id": current_user['user_id'], "statement_id": statement_id},
        {"_id": 0}
    ).to_list(10000)
    
    mapping_dict = {m['transaction_index']: m['supplier_name'] for m in mappings}
    
    # Add mapping info to transactions (only debit transactions)
    transactions = []
    for idx, txn in enumerate(statement.get('transactions', [])):
        if txn.get('debit') and float(txn.get('debit') or 0) > 0:
            txn_with_mapping = {
                **txn,
                "index": idx,
                "mapped_supplier": mapping_dict.get(idx)
            }
            transactions.append(txn_with_mapping)
    
    return {
        "statement_id": statement_id,
        "filename": statement.get('filename'),
        "transactions": transactions,
        "suppliers": list(suppliers.values())
    }

@api_router.post("/bank-statement/map-payable")
async def map_payable_transaction(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Manually map a debit transaction to a supplier"""
    statement_id = data.get('statement_id')
    transaction_index = data.get('transaction_index')
    supplier_name = data.get('supplier_name')
    
    if statement_id is None or transaction_index is None:
        raise HTTPException(status_code=400, detail="statement_id and transaction_index are required")
    
    statement = await db.bank_statements.find_one(
        {"id": statement_id, "user_id": current_user['user_id']},
        {"_id": 0}
    )
    
    if not statement:
        raise HTTPException(status_code=404, detail="Bank statement not found")
    
    if supplier_name:
        await db.bank_payable_mappings.update_one(
            {
                "user_id": current_user['user_id'],
                "statement_id": statement_id,
                "transaction_index": transaction_index
            },
            {
                "$set": {
                    "user_id": current_user['user_id'],
                    "statement_id": statement_id,
                    "transaction_index": transaction_index,
                    "supplier_name": supplier_name,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        return {"message": f"Transaction mapped to {supplier_name}"}
    else:
        await db.bank_payable_mappings.delete_one({
            "user_id": current_user['user_id'],
            "statement_id": statement_id,
            "transaction_index": transaction_index
        })
        return {"message": "Transaction mapping removed"}

@api_router.post("/bank-statement/bulk-map")
async def bulk_map_transactions(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Bulk map multiple transactions to a buyer/supplier"""
    statement_id = data.get('statement_id')
    transaction_indices = data.get('transaction_indices', [])
    party_name = data.get('party_name')
    mapping_type = data.get('mapping_type', 'receivable')  # 'receivable' or 'payable'
    
    if not statement_id or not transaction_indices or not party_name:
        raise HTTPException(status_code=400, detail="statement_id, transaction_indices, and party_name are required")
    
    statement = await db.bank_statements.find_one(
        {"id": statement_id, "user_id": current_user['user_id']},
        {"_id": 0}
    )
    
    if not statement:
        raise HTTPException(status_code=404, detail="Bank statement not found")
    
    collection = db.bank_transaction_mappings if mapping_type == 'receivable' else db.bank_payable_mappings
    field_name = 'buyer_name' if mapping_type == 'receivable' else 'supplier_name'
    
    for idx in transaction_indices:
        await collection.update_one(
            {
                "user_id": current_user['user_id'],
                "statement_id": statement_id,
                "transaction_index": idx
            },
            {
                "$set": {
                    "user_id": current_user['user_id'],
                    "statement_id": statement_id,
                    "transaction_index": idx,
                    field_name: party_name,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
    
    return {"message": f"Mapped {len(transaction_indices)} transactions to {party_name}"}

# ============= User Profile Endpoints =============

@api_router.get("/users/me")
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """Get current user's profile"""
    user_doc = await db.users.find_one({"id": current_user['user_id']}, {"_id": 0, "password_hash": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Convert datetime if needed
    if isinstance(user_doc.get('created_at'), str):
        pass  # Keep as string
    elif user_doc.get('created_at'):
        user_doc['created_at'] = user_doc['created_at'].isoformat()
    
    if user_doc.get('subscription_valid_until'):
        if isinstance(user_doc['subscription_valid_until'], str):
            pass
        else:
            user_doc['subscription_valid_until'] = user_doc['subscription_valid_until'].isoformat()
    
    return user_doc

@api_router.put("/users/me")
async def update_current_user_profile(
    update_data: UserProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update current user's profile"""
    user_doc = await db.users.find_one({"id": current_user['user_id']}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_dict = {}
    
    # Update name if provided
    if update_data.name:
        update_dict["name"] = update_data.name
    
    # Update password if both current and new provided
    if update_data.current_password and update_data.new_password:
        password_hash = user_doc.get('password_hash')
        if not bcrypt.checkpw(update_data.current_password.encode(), password_hash.encode()):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        
        new_password_hash = bcrypt.hashpw(update_data.new_password.encode(), bcrypt.gensalt()).decode()
        update_dict["password_hash"] = new_password_hash
    
    if not update_dict:
        return {"message": "No updates provided"}
    
    await db.users.update_one(
        {"id": current_user['user_id']},
        {"$set": update_dict}
    )
    
    return {"message": "Profile updated successfully"}

# ============= Admin Endpoints =============

async def check_admin(current_user: dict):
    """Helper to verify admin role"""
    user_doc = await db.users.find_one({"id": current_user['user_id']}, {"_id": 0})
    if not user_doc or user_doc.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_doc

@api_router.get("/admin/users")
async def get_all_users(current_user: dict = Depends(get_current_user)):
    """Get all users with their company details (admin only)"""
    await check_admin(current_user)
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    # Fetch company settings for each user
    result = []
    for user in users:
        # Convert datetime fields
        if isinstance(user.get('created_at'), str):
            pass
        elif user.get('created_at'):
            user['created_at'] = user['created_at'].isoformat()
        
        if user.get('subscription_valid_until'):
            if isinstance(user['subscription_valid_until'], str):
                pass
            else:
                user['subscription_valid_until'] = user['subscription_valid_until'].isoformat()
        
        # Ensure is_active has a default value
        if 'is_active' not in user:
            user['is_active'] = True
        
        # Get company settings for this user
        company_settings = await db.company_settings.find_one(
            {"user_id": user['id']}, 
            {"_id": 0}
        )
        user['company_details'] = company_settings or {}
        
        # Get invoice count for this user
        invoice_count = await db.invoices.count_documents({"user_id": user['id']})
        user['invoice_count'] = invoice_count
        
        result.append(user)
    
    return result

@api_router.get("/admin/users/{user_id}")
async def get_user_by_id(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific user (admin only)"""
    await check_admin(current_user)
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Convert datetime fields
    if isinstance(user_doc.get('created_at'), str):
        pass
    elif user_doc.get('created_at'):
        user_doc['created_at'] = user_doc['created_at'].isoformat()
    
    if user_doc.get('subscription_valid_until'):
        if isinstance(user_doc['subscription_valid_until'], str):
            pass
        else:
            user_doc['subscription_valid_until'] = user_doc['subscription_valid_until'].isoformat()
    
    return user_doc

@api_router.put("/admin/users/{user_id}")
async def update_user(
    user_id: str,
    update_data: AdminUserUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update user access status (admin only)"""
    await check_admin(current_user)
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent disabling own account
    if user_id == current_user['user_id'] and update_data.is_active == False:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")
    
    update_dict = {}
    
    if update_data.is_active is not None:
        update_dict["is_active"] = update_data.is_active
    
    if update_data.subscription_valid_until:
        try:
            # Parse ISO date string
            subscription_date = datetime.fromisoformat(update_data.subscription_valid_until.replace('Z', '+00:00'))
            update_dict["subscription_valid_until"] = subscription_date.isoformat()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format (YYYY-MM-DD)")
    
    if not update_dict:
        return {"message": "No updates provided"}
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": update_dict}
    )
    
    return {"message": "User updated successfully"}

@api_router.post("/admin/users/{user_id}/reset-password")
async def admin_reset_user_password(
    user_id: str,
    password_data: AdminPasswordReset,
    current_user: dict = Depends(get_current_user)
):
    """Reset a user's password (admin only)"""
    await check_admin(current_user)
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot reset admin password via this endpoint
    if user_doc.get('role') == 'admin':
        raise HTTPException(status_code=400, detail="Cannot reset admin password via this endpoint")
    
    if len(password_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Hash the new password
    new_password_hash = bcrypt.hashpw(password_data.new_password.encode(), bcrypt.gensalt()).decode()
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": new_password_hash}}
    )
    
    logging.info(f"Admin {current_user['user_id']} reset password for user {user_id}")
    
    return {"message": "Password reset successfully"}

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a user (admin only)"""
    await check_admin(current_user)
    
    # Prevent deleting self
    if user_id == current_user['user_id']:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also delete user's invoices and settings
    await db.invoices.delete_many({"user_id": user_id})
    await db.company_settings.delete_many({"user_id": user_id})
    
    return {"message": "User and associated data deleted successfully"}

@api_router.get("/admin/stats")
async def get_admin_stats(current_user: dict = Depends(get_current_user)):
    """Get platform statistics (admin only)"""
    await check_admin(current_user)
    
    total_users = await db.users.count_documents({})
    total_invoices = await db.invoices.count_documents({})
    
    # Count active subscriptions
    active_subs = await db.users.count_documents({
        "subscription_valid_until": {"$gte": datetime.now(timezone.utc).isoformat()}
    })
    
    return {
        "total_users": total_users,
        "total_invoices": total_invoices,
        "active_subscriptions": active_subs
    }

@api_router.get("/admin/invoices")
async def get_all_invoices_admin(
    search: Optional[str] = None,
    company_name: Optional[str] = None,
    invoice_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all invoices from all companies (admin only)"""
    await check_admin(current_user)
    
    # Get all invoices
    invoices = await db.invoices.find(
        {},
        {"_id": 0, "file_data": 0}
    ).sort("created_at", -1).to_list(10000)
    
    # Get all users and their company settings
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    user_map = {u['id']: u for u in users}
    
    company_settings = await db.company_settings.find({}, {"_id": 0}).to_list(1000)
    company_map = {cs['user_id']: cs for cs in company_settings}
    
    # Enrich invoices with company details
    result = []
    for invoice in invoices:
        user_id = invoice.get('user_id')
        user = user_map.get(user_id, {})
        company = company_map.get(user_id, {})
        
        # Add company info to invoice
        invoice['company_name'] = company.get('company_name', 'N/A')
        invoice['company_gst'] = company.get('company_gst_no', 'N/A')
        invoice['user_name'] = user.get('name', 'Unknown')
        invoice['user_email'] = user.get('email', 'Unknown')
        
        # Apply filters
        if company_name and company_name.lower() not in invoice['company_name'].lower():
            continue
        
        if invoice_type and invoice.get('invoice_type') != invoice_type:
            continue
        
        if search:
            search_lower = search.lower()
            searchable = f"{invoice.get('company_name', '')} {invoice.get('extracted_data', {}).get('invoice_no', '')} {invoice.get('extracted_data', {}).get('supplier_name', '')} {invoice.get('user_name', '')}".lower()
            if search_lower not in searchable:
                continue
        
        # Convert datetime fields
        if isinstance(invoice.get('created_at'), str):
            pass
        elif invoice.get('created_at'):
            invoice['created_at'] = invoice['created_at'].isoformat()
        
        if isinstance(invoice.get('updated_at'), str):
            pass
        elif invoice.get('updated_at'):
            invoice['updated_at'] = invoice['updated_at'].isoformat()
        
        result.append(invoice)
    
    return result

@api_router.get("/admin/companies")
async def get_all_companies(current_user: dict = Depends(get_current_user)):
    """Get list of all companies for filtering (admin only)"""
    await check_admin(current_user)
    
    company_settings = await db.company_settings.find({}, {"_id": 0}).to_list(1000)
    companies = [
        {
            "user_id": cs.get('user_id'),
            "company_name": cs.get('company_name'),
            "company_gst_no": cs.get('company_gst_no')
        }
        for cs in company_settings if cs.get('company_name')
    ]
    
    return companies

# ============= Financial Analytics Endpoints =============

@api_router.get("/reports/financial-summary")
async def get_financial_summary(
    year: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get month-wise financial summary for charts"""
    query = {"user_id": current_user['user_id']}
    
    invoices = await db.invoices.find(query, {"_id": 0}).to_list(10000)
    
    # Group by month
    monthly_data = {}
    
    for invoice in invoices:
        month = invoice.get('month')
        if not month:
            continue
        
        if year and not month.startswith(year):
            continue
        
        if month not in monthly_data:
            monthly_data[month] = {
                "month": month,
                "purchase_count": 0,
                "sales_count": 0,
                "purchase_amount": 0,
                "sales_amount": 0,
                "purchase_gst": 0,
                "sales_gst": 0
            }
        
        inv_type = invoice.get('invoice_type', 'purchase')
        ext_data = invoice.get('extracted_data', {})
        
        if inv_type == 'purchase':
            monthly_data[month]["purchase_count"] += 1
            monthly_data[month]["purchase_amount"] += ext_data.get('total_amount') or 0
            monthly_data[month]["purchase_gst"] += ext_data.get('gst') or 0
        else:
            monthly_data[month]["sales_count"] += 1
            monthly_data[month]["sales_amount"] += ext_data.get('total_amount') or 0
            monthly_data[month]["sales_gst"] += ext_data.get('gst') or 0
    
    # Convert to sorted list
    result = sorted(monthly_data.values(), key=lambda x: x['month'])
    
    # Calculate totals
    totals = {
        "total_purchase": sum(m['purchase_amount'] for m in result),
        "total_sales": sum(m['sales_amount'] for m in result),
        "total_purchase_gst": sum(m['purchase_gst'] for m in result),
        "total_sales_gst": sum(m['sales_gst'] for m in result)
    }
    
    return {
        "monthly_data": result,
        "totals": totals
    }

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