import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SorobanRpc, TransactionBuilder } from '@stellar/stellar-sdk';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  async submit(xdr: string): Promise<{ hash: string }> {
    const rpcUrl =
      process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org';
    const networkPassphrase =
      process.env.STELLAR_NETWORK_PASSPHRASE ??
      'Test SDF Network ; September 2015';

    let tx: ReturnType<typeof TransactionBuilder.fromXDR>;
    try {
      tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
    } catch {
      throw new BadRequestException('Invalid transaction XDR');
    }

    const server = new SorobanRpc.Server(rpcUrl);
    const response = await server.sendTransaction(tx);

    if (response.status === 'ERROR') {
      if (this.isSlippageError(response)) {
        throw new UnprocessableEntityException({ code: 'SLIPPAGE_EXCEEDED' });
      }
      this.logger.warn(`Transaction failed hash=${response.hash}`);
      throw new UnprocessableEntityException({ code: 'TRANSACTION_FAILED' });
    }

    return { hash: response.hash };
  }

  private isSlippageError(
    response: SorobanRpc.Api.SendTransactionResponse,
  ): boolean {
    try {
      const resultXdr = response.errorResult?.toXDR('base64') ?? '';
      const payload = resultXdr + JSON.stringify(response);
      return /slippage|insufficient.?output|min.?received|AmountOutMin/i.test(
        payload,
      );
    } catch {
      return false;
    }
  }
}
