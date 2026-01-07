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

class InvoiceData(BaseModel):
    invoice_no: Optional[str] = None
    invoice_date: Optional[str] = None
    supplier_name: Optional[str] = None
    address: Optional[str] = None
    gst_no: Optional[str] = None
    basic_amount: Optional[float] = None
    gst: Optional[float] = None
    total_amount: Optional[float] = None
    gst_rate: Optional[float] = None  # GST percentage
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

class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    invoice_type: str = "purchase"  # purchase or sales
    filename: str
    file_data: str
    file_type: str
    extracted_data: InvoiceData
    confidence_scores: ConfidenceScores
    status: str = "pending"  # pending, verified, exported
    month: Optional[str] = None  # YYYY-MM format
    financial_year: Optional[str] = None  # e.g., "2024-25"
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
    format: str  # tally, csv, excel

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
        # Try DD/MM/YYYY format
        if '/' in date_str:
            parts = date_str.split('/')
            if len(parts) == 3:
                day, month, year = parts
                date_obj = datetime(int(year), int(month), int(day))
        # Try YYYY-MM-DD format
        elif '-' in date_str:
            date_obj = datetime.fromisoformat(date_str.split('T')[0])
        else:
            return None, None
        
        month_str = date_obj.strftime('%Y-%m')
        
        # Calculate financial year (Apr-Mar)
        if date_obj.month >= 4:
            fy = f"{date_obj.year}-{str(date_obj.year + 1)[-2:]}"
        else:
            fy = f"{date_obj.year - 1}-{str(date_obj.year)[-2:]}"
        
        return month_str, fy
    except:
        return None, None

async def extract_invoice_data(file_data: bytes, filename: str, invoice_type: str = "purchase") -> tuple[InvoiceData, ConfidenceScores]:
    """Extract invoice data using OpenAI Vision API"""
    try:
        llm_key = os.environ.get('EMERGENT_LLM_KEY')
        if not llm_key:
            raise ValueError("EMERGENT_LLM_KEY not found")

        # Initialize chat with Gemini (supports file attachments)
        chat = LlmChat(
            api_key=llm_key,
            session_id=str(uuid.uuid4()),
            system_message=f"You are an expert invoice data extraction assistant for {'purchase' if invoice_type == 'purchase' else 'sales'} invoices. Extract structured data accurately."
        ).with_model("gemini", "gemini-2.5-flash")

        # Save file temporarily
        temp_file = f"/tmp/{uuid.uuid4()}_{filename}"
        with open(temp_file, "wb") as f:
            f.write(file_data)

        # Determine mime type
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
            - Invoice No
            - Invoice Date (in DD/MM/YYYY format)
            - Supplier/Vendor Name
            - Supplier Address
            - Supplier GST No
            - Basic Amount (taxable amount before GST)
            - GST Amount (total GST)
            - Total Amount (final payable amount)
            - GST Rate (percentage like 5, 12, 18, 28)
            - If GST is split, extract: CGST, SGST, IGST amounts
            
            Respond in JSON format with keys: invoice_no, invoice_date, supplier_name, address, gst_no, basic_amount, gst, total_amount, gst_rate, cgst, sgst, igst.
            Also include a confidence score (0-100) for each field.
            
            Format:
            {
                "data": {"invoice_no": "...", "invoice_date": "DD/MM/YYYY", ...},
                "confidence": {"invoice_no": 95, ...}
            }
            """
        else:  # sales
            prompt = """Extract the following information from this SALES invoice:
            - Invoice No
            - Invoice Date (in DD/MM/YYYY format)
            - Customer/Buyer Name
            - Customer Address
            - Customer GST No
            - Basic Amount (taxable amount before GST)
            - GST Amount (total GST)
            - Total Amount (final receivable amount)
            - GST Rate (percentage like 5, 12, 18, 28)
            - If GST is split, extract: CGST, SGST, IGST amounts
            
            Respond in JSON format with keys: invoice_no, invoice_date, supplier_name (use customer name here), address, gst_no, basic_amount, gst, total_amount, gst_rate, cgst, sgst, igst.
            Also include a confidence score (0-100) for each field.
            
            Format:
            {
                "data": {"invoice_no": "...", "invoice_date": "DD/MM/YYYY", ...},
                "confidence": {"invoice_no": 95, ...}
            }
            """

        user_message = UserMessage(
            text=prompt,
            file_contents=[file_content]
        )

        response = await chat.send_message(user_message)
        
        # Clean up temp file
        if os.path.exists(temp_file):
            os.remove(temp_file)

        # Parse response
        import json
        import re
        response_text = response.strip()
        
        # Try to extract JSON from markdown code blocks
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        # Try to find JSON object using regex
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            response_text = json_match.group(0)
        
        result = json.loads(response_text)
        
        # Extract data and confidence
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
        # Return empty data with low confidence on error
        return InvoiceData(), ConfidenceScores(
            invoice_no=0.5, invoice_date=0.5, supplier_name=0.5, address=0.5,
            gst_no=0.5, basic_amount=0.5, gst=0.5, total_amount=0.5
        )

# Routes
@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
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

@api_router.post("/invoices/upload")
async def upload_invoice(
    file: UploadFile = File(...),
    invoice_type: str = "purchase",
    current_user: dict = Depends(get_current_user)
):
    # Validate file type
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, and PDF are allowed.")
    
    # Read file data
    file_data = await file.read()
    
    # Extract data using AI
    extracted_data, confidence_scores = await extract_invoice_data(file_data, file.filename, invoice_type)
    
    # Get month and FY from invoice date
    month, fy = get_month_and_fy(extracted_data.invoice_date or "")
    
    # Store file as base64
    file_base64 = base64.b64encode(file_data).decode()
    
    invoice = Invoice(
        user_id=current_user['user_id'],
        invoice_type=invoice_type,
        filename=file.filename,
        file_data=file_base64,
        file_type=file.content_type,
        extracted_data=extracted_data,
        confidence_scores=confidence_scores,
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
    """Upload multiple invoices at once"""
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 files allowed per batch")
    
    invoices = []
    successful = 0
    failed = 0
    
    for file in files:
        try:
            # Validate file type
            allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
            if file.content_type not in allowed_types:
                failed += 1
                continue
            
            # Read file data
            file_data = await file.read()
            
            # Extract data using AI
            extracted_data, confidence_scores = await extract_invoice_data(file_data, file.filename, invoice_type)
            
            # Get month and FY from invoice date
            month, fy = get_month_and_fy(extracted_data.invoice_date or "")
            
            # Store file as base64
            file_base64 = base64.b64encode(file_data).decode()
            
            invoice = Invoice(
                user_id=current_user['user_id'],
                invoice_type=invoice_type,
                filename=file.filename,
                file_data=file_base64,
                file_type=file.content_type,
                extracted_data=extracted_data,
                confidence_scores=confidence_scores,
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
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user['user_id']}
    if invoice_type:
        query["invoice_type"] = invoice_type
    
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
    
    # Recalculate month and FY if date changed
    month, fy = get_month_and_fy(update_data.extracted_data.invoice_date or "")
    
    update_dict = {
        "extracted_data": update_data.extracted_data.model_dump(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "month": month,
        "financial_year": fy
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
    month: Optional[str] = None,  # YYYY-MM format
    financial_year: Optional[str] = None,  # e.g., "2024-25"
    current_user: dict = Depends(get_current_user)
):
    """Get monthly GST reconciliation report"""
    query = {"user_id": current_user['user_id'], "status": "verified"}
    
    if month:
        query["month"] = month
    elif financial_year:
        query["financial_year"] = financial_year
    
    invoices = await db.invoices.find(query, {"_id": 0}).to_list(10000)
    
    # Calculate aggregates
    purchase_invoices = [inv for inv in invoices if inv.get('invoice_type') == 'purchase']
    sales_invoices = [inv for inv in invoices if inv.get('invoice_type') == 'sales']
    
    total_purchase_amount = sum(inv['extracted_data'].get('total_amount', 0) for inv in purchase_invoices)
    total_sales_amount = sum(inv['extracted_data'].get('total_amount', 0) for inv in sales_invoices)
    
    total_purchase_gst = sum(inv['extracted_data'].get('gst', 0) for inv in purchase_invoices)
    total_sales_gst = sum(inv['extracted_data'].get('gst', 0) for inv in sales_invoices)
    
    # GST breakdown by rate
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
    """Get list of months with invoices"""
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
        # Generate Tally XML
        xml_data = generate_tally_xml(invoices)
        return {"format": "tally", "data": xml_data}
    elif export_request.format == "csv":
        # Generate CSV
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
    csv = "Type,Invoice No,Invoice Date,Party Name,Address,GST No,Basic Amount,GST,Total Amount,Status\n"
    
    for invoice in invoices:
        data = invoice['extracted_data']
        inv_type = invoice.get('invoice_type', 'purchase')
        csv += f"{inv_type.capitalize()},"
        csv += f"{data.get('invoice_no', '')},"
        csv += f"{data.get('invoice_date', '')},"
        csv += f"{data.get('supplier_name', '')},"
        csv += f"\"{data.get('address', '')}\","
        csv += f"{data.get('gst_no', '')},"
        csv += f"{data.get('basic_amount', '')},"
        csv += f"{data.get('gst', '')},"
        csv += f"{data.get('total_amount', '')},"
        csv += f"{invoice.get('status', '')}\n"
    
    return csv

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()