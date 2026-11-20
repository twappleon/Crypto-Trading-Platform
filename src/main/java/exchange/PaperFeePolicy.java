package exchange;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * PAPER-only immutable fee schedule: buyer pays BASE from received asset;
 * seller pays QUOTE from received asset. Deterministic 18-decimal floor,
 * never a debit beyond the resting BUY collateral. NOT a production tariff.
 */
public final class PaperFeePolicy {
    public static final String FEE_ACCOUNT = "paper_fee_vault";
    private static final BigDecimal BPS_DENOMINATOR = new BigDecimal("10000");
    private final int makerBps, takerBps;
    public record Fees(BigDecimal buyerFeeBase, BigDecimal sellerFeeQuote,
                       BigDecimal buyerNetBase, BigDecimal sellerNetQuote) {}

    public PaperFeePolicy(int makerBps, int takerBps) {
        if (makerBps < 0 || makerBps > 1000 || takerBps < 0 || takerBps > 1000)
            throw new IllegalArgumentException("fee rates must be 0..1000 basis points");
        this.makerBps = makerBps;
        this.takerBps = takerBps;
    }

    public int makerBps() { return makerBps; }
    public int takerBps() { return takerBps; }

    public Fees calculate(BigDecimal quantity, BigDecimal cost, ExchangeCore.Side makerSide) {
        PostgresLedger.requirePositiveAmount(quantity);
        PostgresLedger.requirePositiveAmount(cost);
        if (makerSide == null) throw new IllegalArgumentException("maker side required");
        int buyerRate = makerSide == ExchangeCore.Side.BUY ? makerBps : takerBps;
        int sellerRate = makerSide == ExchangeCore.Side.SELL ? makerBps : takerBps;
        BigDecimal buyerFee = fee(quantity, buyerRate);
        BigDecimal sellerFee = fee(cost, sellerRate);
        BigDecimal buyerNet = quantity.subtract(buyerFee);
        BigDecimal sellerNet = cost.subtract(sellerFee);
        PostgresLedger.requirePositiveAmount(buyerNet);
        PostgresLedger.requirePositiveAmount(sellerNet);
        return new Fees(buyerFee, sellerFee, buyerNet, sellerNet);
    }

    private static BigDecimal fee(BigDecimal gross, int bps) {
        if (bps == 0) return BigDecimal.ZERO;
        BigDecimal charged = gross.multiply(BigDecimal.valueOf(bps))
                .divide(BPS_DENOMINATOR, 18, RoundingMode.DOWN).stripTrailingZeros();
        if (charged.signum() > 0) PostgresLedger.requirePositiveAmount(charged);
        return charged;
    }
}
