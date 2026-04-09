import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Extract message from different exception types
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const excResponse = exceptionResponse as any;
      message = excResponse.message || message;
      error = excResponse.error || error;
    } else {
      message = exceptionResponse as string;
    }

    // Normalize error name
    error = this.normalizeErrorName(status, error);

    const payload: ErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log only server errors (5xx)
    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - Status: ${status}`,
        exception.stack,
      );
    }

    response.status(status).json(payload);
  }

  private normalizeErrorName(status: number, errorName: string): string {
    const errorMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BadRequest',
      [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
      [HttpStatus.FORBIDDEN]: 'Forbidden',
      [HttpStatus.NOT_FOUND]: 'NotFound',
      [HttpStatus.CONFLICT]: 'Conflict',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'UnprocessableEntity',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'InternalServerError',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'ServiceUnavailable',
    };

    return errorMap[status] || errorName || 'Error';
  }
}
