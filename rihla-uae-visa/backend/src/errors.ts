/** An error the API can show to a person: a status, a stable code for the app, and plain words. */
export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 502 | 503,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
