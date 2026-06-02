import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

interface FastifyReply {
  status(code: number): this;
  send(payload: unknown): this;
}

interface FastifyRequest {
  url: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    response.status(status).send({
      statusCode: status,
      message: typeof message === 'object' ? (message as Record<string, unknown>)['message'] ?? message : message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
