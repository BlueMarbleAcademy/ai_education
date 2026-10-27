# Blue Marble Academy API Backend

This backend provides a FastAPI-based API for the Blue Marble Academy platform, with Azure AD B2C authentication.

## Setup

1. Create a Python virtual environment:

   ```bash
   python -m venv venv
   ```

2. Activate the virtual environment:

   - On Windows:
     ```bash
     venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Update the `.env` file with your Azure AD B2C credentials:
   - CLIENT_ID: Your Azure B2C application client ID
   - CLIENT_SECRET: Your Azure B2C application client secret
   - TENANT_NAME: Your Azure B2C tenant name
   - AUTHORITY: Your Azure B2C authority URL
   - API_SCOPE: The scope required to access your API

## Running the Server

Run the FastAPI server:

```bash
uvicorn main:app --reload
```

Or use the provided script:

```bash
chmod +x run.sh  # Make it executable (first time only)
./run.sh
```

## Maintaining Dependencies

Whenever you install a new Python package during development, make sure to update `requirements.txt` so new development environments remain consistent.

### Study Planner Materials and Review Scheduling

- Planner uploads accept PDF, DOCX, TXT, PPTX, PNG, JPG, and JPEG files up to 20 MB each.
- Scans and diagram images use the existing OpenAI key and incur image-reading API usage. No Azure OCR account is needed. Files with over 40 visual pages/images must be split. Unreadable scans produce an error rather than an empty successful upload.
- Reanalyzing older uploads refreshes their extracted text and visual evidence. Topic source IDs are restricted to the plan's connected files; repeated-topic counts mean distinct source files.
- Confirm topics again to create automatic review activities and reserve the last available pre-exam day for final review. Existing completed work is preserved. If the available time cannot support a separate final review day, the plan shows a warning.
- The missed-day control moves unfinished work to available days before the exam. It can shorten estimates to a minimum of five minutes per activity, preserves completed work, and rejects impossible rearrangements without saving a partial result.

To check the installed version of a package:

```bash
pip show <package_name>
```

and promptly add it to the `requirements.txt` file.


## API Documentation

When running the server, access the auto-generated API documentation at:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Endpoints

- `GET /`: Root endpoint - public
- `GET /health`: Health check endpoint - public
- `GET /tasks`: Get all tasks - protected with Azure AD B2C authentication

## Authentication

This API uses Azure AD B2C for authentication. To access protected endpoints, include a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

The token should be obtained from the frontend after a successful Azure AD B2C login.
