# =====================================================
# MIGRATION GUIDE: Remove Emergent Dependencies
# =====================================================

## Overview
The application currently uses `emergentintegrations` library for LLM calls.
To make it standalone, replace with direct OpenAI/Google SDK calls.

## Step 1: Update requirements.txt
Replace your requirements.txt with requirements_standalone.txt:
```bash
cp requirements_standalone.txt requirements.txt
pip install -r requirements.txt
```

## Step 2: Update .env file
Change from:
```
EMERGENT_LLM_KEY=your_key
```

To (choose one or both):
```
OPENAI_API_KEY=sk-your-openai-key
GOOGLE_API_KEY=your-google-api-key
```

## Step 3: Update server.py imports

REMOVE this line:
```python
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
```

ADD this line:
```python
from llm_utils import LLMClient, extract_invoice_data_standalone, extract_bank_transactions_standalone
```

## Step 4: Update extract_invoice_data function

REPLACE the entire extract_invoice_data function with:

```python
async def extract_invoice_data(file_data: bytes, filename: str, invoice_type: str = "purchase") -> tuple[InvoiceData, ConfidenceScores]:
    """Extract invoice data using AI"""
    try:
        data_dict, confidence_dict = await extract_invoice_data_standalone(file_data, filename, invoice_type)
        
        # Map to InvoiceData model
        extracted_data = InvoiceData(
            invoice_no=data_dict.get('invoice_no', ''),
            invoice_date=data_dict.get('invoice_date', ''),
            bill_to_name=data_dict.get('buyer_name', ''),
            bill_to_gst=data_dict.get('buyer_gst_no', ''),
            bill_to_address=data_dict.get('buyer_address', ''),
            supplier_name=data_dict.get('supplier_name', ''),
            supplier_gst=data_dict.get('supplier_gst_no', ''),
            supplier_address=data_dict.get('supplier_address', ''),
            basic_amount=float(data_dict.get('basic_amount', 0) or 0),
            gst=float(data_dict.get('gst', 0) or 0),
            total_amount=float(data_dict.get('total_amount', 0) or 0)
        )
        
        confidence = ConfidenceScores(
            invoice_no=confidence_dict.get('invoice_no', 0),
            invoice_date=confidence_dict.get('invoice_date', 0),
            bill_to_name=confidence_dict.get('buyer_name', 0),
            bill_to_gst=confidence_dict.get('buyer_gst_no', 0),
            supplier_name=confidence_dict.get('supplier_name', 0),
            supplier_gst=confidence_dict.get('supplier_gst_no', 0),
            basic_amount=confidence_dict.get('basic_amount', 0),
            gst=confidence_dict.get('gst', 0),
            total_amount=confidence_dict.get('total_amount', 0)
        )
        
        return extracted_data, confidence
        
    except Exception as e:
        logging.error(f"Error extracting invoice data: {str(e)}")
        return InvoiceData(), ConfidenceScores()
```

## Step 5: Update bank statement extraction

In the `extract_transactions_from_bank_statement` function, replace the LlmChat usage with:

```python
# Instead of:
# chat = LlmChat(api_key=llm_key, ...).with_model("openai", "gpt-4o")
# response = await chat.send_message(...)

# Use:
from llm_utils import extract_bank_transactions_standalone
transactions = await extract_bank_transactions_standalone(text_content)
```

## Step 6: Environment Variables Reference

For Git deployment, set these environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| MONGO_URL | MongoDB connection string | Yes |
| DB_NAME | Database name | Yes |
| JWT_SECRET | Secret for JWT tokens | Yes |
| OPENAI_API_KEY | OpenAI API key | One of these |
| GOOGLE_API_KEY | Google AI API key | required |

## Cost Comparison

| Provider | Model | Cost (approx) |
|----------|-------|---------------|
| OpenAI | gpt-4o | $5/1M input, $15/1M output |
| Google | gemini-1.5-flash | $0.075/1M input, $0.30/1M output |

Gemini is significantly cheaper for invoice processing tasks.

## Notes

1. The `llm_utils.py` file provides a unified interface for both OpenAI and Google SDKs
2. It automatically selects the provider based on available API keys
3. For PDF processing, Gemini is preferred as it handles PDFs natively
4. OpenAI requires text extraction from PDFs first (using pypdf)
