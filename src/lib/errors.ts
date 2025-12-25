// src/lib/errors.ts
export class AppError extends Error {
  code: string;
  status: number;
  extra?: unknown;

  constructor(code: string, message: string, status = 400, extra?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}
