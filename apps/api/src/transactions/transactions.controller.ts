import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';

export class SubmitTransactionDto {
  xdr: string;
}

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a signed Stellar transaction XDR' })
  @ApiBody({ schema: { properties: { xdr: { type: 'string' } } } })
  @ApiResponse({ status: 201, schema: { properties: { hash: { type: 'string' } } } })
  @ApiResponse({ status: 400, description: 'Invalid XDR' })
  @ApiResponse({
    status: 422,
    description: 'Transaction failed (SLIPPAGE_EXCEEDED or TRANSACTION_FAILED)',
  })
  submit(@Body() body: SubmitTransactionDto): Promise<{ hash: string }> {
    return this.transactionsService.submit(body.xdr);
  }
}
