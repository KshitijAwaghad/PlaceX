# API reference

The backend listens on port `5000` by default.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health check |
| `POST` | `/resume/upload` | Upload and extract PDF, DOCX, JPG, JPEG, PNG, or WEBP resumes |
| `POST` | `/analyze` | Compare `resumeText` with `jobDescription` |
| `POST` | `/job/analyze` | Alias for career analysis |
| `POST` | `/career/simulate` | Recompute a score with selected skills |
| `GET` | `/career/history` | List the signed-in student's saved analyses |
| `GET` | `/career/history/:historyId` | Retrieve one saved analysis |

Successful API responses use `{ success: true, data: ... }`. Upload files use the multipart field name `resume`.
