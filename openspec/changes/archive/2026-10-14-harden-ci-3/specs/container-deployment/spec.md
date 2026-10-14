## ADDED Requirements

### Requirement: Images build from pinned bases and carry only runtime files
Every image the stack builds or runs SHALL name its base image by exact version and content digest, so a rebuild of an unchanged repository uses the same base. The backend image SHALL NOT contain the backend's tests, test configuration or development-only startup files. Image build contexts SHALL NOT include version-control data, local tool state, specifications or documentation.

#### Scenario: Upstream base image republished
- **WHEN** a new `python:3.12-slim` image is published upstream and the backend image is rebuilt from the same commit
- **THEN** the build uses the same base image as before

#### Scenario: Backend image contents
- **WHEN** the backend image is built
- **THEN** it contains no `tests` directory, `conftest.py`, `pytest.ini` or test requirements file

### Requirement: The web server doesn't advertise its version
Responses from the frontend web server SHALL NOT state the server software's version, in headers or error pages.

#### Scenario: Error page
- **WHEN** a request for a missing static file gets a 404
- **THEN** neither the `Server` header nor the page body contains an nginx version number
