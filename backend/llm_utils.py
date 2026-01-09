"""
LLM Utilities - Standalone version using standard OpenAI and Google SDKs
Replace emergentintegrations with direct API calls
"""
import os
import base64
import json
import logging
from typing import Optional, Tuple
import httpx

# For OpenAI
try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

# For Google Gemini
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


class LLMClient:
    """Unified LLM client supporting OpenAI and Google Gemini"""
    
    def __init__(self, provider: str = "openai"):
        """
        Initialize LLM client
        
        Args:
            provider: "openai" or "gemini"
        """
        self.provider = provider
        
        if provider == "openai":
            self.api_key = os.environ.get("OPENAI_API_KEY")
            if not self.api_key:
                raise ValueError("OPENAI_API_KEY not found in environment")
            if OPENAI_AVAILABLE:
                self.client = AsyncOpenAI(api_key=self.api_key)
            else:
                raise ImportError("openai package not installed. Run: pip install openai")
                
        elif provider == "gemini":
            self.api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
            if not self.api_key:
                raise ValueError("GOOGLE_API_KEY or GEMINI_API_KEY not found in environment")
            if GEMINI_AVAILABLE:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel("gemini-1.5-flash")
            else:
                raise ImportError("google-generativeai package not installed. Run: pip install google-generativeai")
        else:
            raise ValueError(f"Unknown provider: {provider}. Use 'openai' or 'gemini'")
    
    async def extract_text(self, prompt: str, system_message: str = "") -> str:
        """
        Send a text-only prompt to the LLM
        
        Args:
            prompt: The user prompt
            system_message: Optional system message
            
        Returns:
            The LLM response text
        """
        if self.provider == "openai":
            messages = []
            if system_message:
                messages.append({"role": "system", "content": system_message})
            messages.append({"role": "user", "content": prompt})
            
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                temperature=0.1
            )
            return response.choices[0].message.content
            
        elif self.provider == "gemini":
            full_prompt = f"{system_message}\n\n{prompt}" if system_message else prompt
            response = self.model.generate_content(full_prompt)
            return response.text
    
    async def extract_from_file(
        self, 
        prompt: str, 
        file_path: str, 
        mime_type: str,
        system_message: str = ""
    ) -> str:
        """
        Send a prompt with file attachment to the LLM
        
        Args:
            prompt: The user prompt
            file_path: Path to the file
            mime_type: MIME type of the file
            system_message: Optional system message
            
        Returns:
            The LLM response text
        """
        with open(file_path, "rb") as f:
            file_data = f.read()
        
        if self.provider == "openai":
            # OpenAI vision - encode image as base64
            if mime_type.startswith("image/"):
                base64_image = base64.b64encode(file_data).decode("utf-8")
                
                messages = []
                if system_message:
                    messages.append({"role": "system", "content": system_message})
                
                messages.append({
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_image}"
                            }
                        }
                    ]
                })
                
                response = await self.client.chat.completions.create(
                    model="gpt-4o",
                    messages=messages,
                    temperature=0.1,
                    max_tokens=4096
                )
                return response.choices[0].message.content
            else:
                # For PDFs and other files, extract text first or use text prompt
                raise ValueError("OpenAI doesn't support PDF files directly. Use Gemini or extract text first.")
                
        elif self.provider == "gemini":
            # Gemini supports both images and PDFs
            import PIL.Image
            import io
            
            if mime_type.startswith("image/"):
                image = PIL.Image.open(io.BytesIO(file_data))
                full_prompt = f"{system_message}\n\n{prompt}" if system_message else prompt
                response = self.model.generate_content([full_prompt, image])
                return response.text
            elif mime_type == "application/pdf":
                # Upload file to Gemini
                uploaded_file = genai.upload_file(file_path, mime_type=mime_type)
                full_prompt = f"{system_message}\n\n{prompt}" if system_message else prompt
                response = self.model.generate_content([full_prompt, uploaded_file])
                # Clean up
                genai.delete_file(uploaded_file.name)
                return response.text
            else:
                raise ValueError(f"Unsupported mime type: {mime_type}")


# Helper functions for invoice extraction

async def extract_invoice_data_standalone(
    file_data: bytes, 
    filename: str, 
    invoice_type: str = "purchase"
) -> Tuple[dict, dict]:
    """
    Extract invoice data using AI (standalone version without emergentintegrations)
    
    Args:
        file_data: Raw file bytes
        filename: Original filename
        invoice_type: "purchase" or "sales"
        
    Returns:
        Tuple of (extracted_data_dict, confidence_scores_dict)
    """
    import uuid
    import tempfile
    
    # Determine provider based on available keys
    if os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY"):
        provider = "gemini"
    elif os.environ.get("OPENAI_API_KEY"):
        provider = "openai"
    else:
        raise ValueError("No API key found. Set GOOGLE_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY")
    
    client = LLMClient(provider=provider)
    
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
    
    # Build prompt based on invoice type
    if invoice_type == "purchase":
        prompt = """Extract the following information from this PURCHASE invoice:
        
        CRITICAL: Extract BOTH supplier (Bill From) and buyer (Bill To) details.
        
        - Invoice No
        - Invoice Date (in DD/MM/YYYY format)
        
        **BILL FROM / SUPPLIER DETAILS (Who is selling):**
        - Supplier Name
        - Supplier Address
        - Supplier GST No
        
        **BILL TO / BUYER DETAILS (Who is purchasing):**
        - Buyer Name
        - Buyer Address
        - Buyer GST No
        
        **AMOUNTS:**
        - Basic Amount (taxable amount before GST)
        - GST Amount (total GST)
        - Total Amount (final payable amount)
        
        Respond in JSON format:
        {
            "data": {"invoice_no": "...", "invoice_date": "DD/MM/YYYY", "supplier_name": "...", "buyer_name": "...", "supplier_gst_no": "...", "buyer_gst_no": "...", "basic_amount": 0, "gst": 0, "total_amount": 0},
            "confidence": {"invoice_no": 95, "invoice_date": 90, ...}
        }
        """
    else:
        prompt = """Extract the following information from this SALES invoice:
        
        CRITICAL: Extract BOTH supplier (Bill From - your company) and buyer (Bill To - customer) details.
        
        - Invoice No
        - Invoice Date (in DD/MM/YYYY format)
        
        **BILL FROM / SUPPLIER DETAILS (Your company - who is selling):**
        - Supplier Name
        - Supplier Address
        - Supplier GST No
        
        **BILL TO / BUYER/CUSTOMER DETAILS (Who is purchasing):**
        - Buyer Name
        - Buyer Address
        - Buyer GST No
        
        **AMOUNTS:**
        - Basic Amount (taxable amount before GST)
        - GST Amount (total GST)
        - Total Amount (final receivable amount)
        
        Respond in JSON format:
        {
            "data": {"invoice_no": "...", "invoice_date": "DD/MM/YYYY", "supplier_name": "...", "buyer_name": "...", "supplier_gst_no": "...", "buyer_gst_no": "...", "basic_amount": 0, "gst": 0, "total_amount": 0},
            "confidence": {"invoice_no": 95, "invoice_date": 90, ...}
        }
        """
    
    system_message = f"You are an expert invoice data extraction assistant for {invoice_type} invoices. Extract structured data accurately. Return only valid JSON."
    
    try:
        # For PDFs with OpenAI, we need to extract text first
        if provider == "openai" and mime_type == "application/pdf":
            from pypdf import PdfReader
            reader = PdfReader(temp_file)
            pdf_text = ""
            for page in reader.pages:
                pdf_text += page.extract_text() or ""
            
            response = await client.extract_text(
                prompt=f"{prompt}\n\nInvoice Text:\n{pdf_text}",
                system_message=system_message
            )
        else:
            response = await client.extract_from_file(
                prompt=prompt,
                file_path=temp_file,
                mime_type=mime_type,
                system_message=system_message
            )
        
        # Clean up temp file
        if os.path.exists(temp_file):
            os.remove(temp_file)
        
        # Parse JSON response
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        result = json.loads(response_text)
        
        return result.get("data", {}), result.get("confidence", {})
        
    except Exception as e:
        logging.error(f"Error extracting invoice data: {str(e)}")
        if os.path.exists(temp_file):
            os.remove(temp_file)
        raise


async def extract_bank_transactions_standalone(
    text_content: str
) -> list:
    """
    Extract bank transactions from text using AI (standalone version)
    
    Args:
        text_content: Extracted text from bank statement
        
    Returns:
        List of transaction dictionaries
    """
    # Determine provider
    if os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY"):
        provider = "gemini"
    elif os.environ.get("OPENAI_API_KEY"):
        provider = "openai"
    else:
        raise ValueError("No API key found")
    
    client = LLMClient(provider=provider)
    
    prompt = """Extract ALL bank transactions from this statement. For each transaction, identify:
    - date (in DD/MM/YYYY format)
    - description (full transaction description)
    - credit (amount received/deposited, null if debit)
    - debit (amount paid/withdrawn, null if credit)
    - balance (running balance if available)
    - party_name (extracted from description - company/person name)
    
    Return as JSON array:
    [
        {"date": "01/01/2025", "description": "...", "credit": 1000, "debit": null, "balance": 5000, "party_name": "ABC Company"},
        ...
    ]
    
    Bank Statement Text:
    """ + text_content
    
    try:
        response = await client.extract_text(
            prompt=prompt,
            system_message="You are a bank statement parsing expert. Extract all transactions accurately."
        )
        
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        transactions = json.loads(response_text)
        return transactions if isinstance(transactions, list) else []
        
    except Exception as e:
        logging.error(f"Error extracting transactions: {str(e)}")
        return []
