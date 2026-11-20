package exchange;

import java.math.BigDecimal;
import static exchange.ExchangeCore.Side;

/** Dependency-free Round 007 deterministic-precision and negative BDD. */
public final class PaperFeePolicyBDD {
    static BigDecimal n(String s){return new BigDecimal(s);}
    static void eq(String expected, BigDecimal actual){
        if(n(expected).compareTo(actual)!=0)throw new AssertionError("expected "+expected+" got "+actual);
    }
    static void reject(Runnable action){
        try{action.run();}catch(IllegalArgumentException good){return;}
        throw new AssertionError("expected negative validation rejection");
    }
    public static void main(String[] ignored){
        PaperFeePolicy p=new PaperFeePolicy(10,25);
        var makerBuy=p.calculate(n("1.23456789"),n("123.456789"),Side.BUY);
        eq("0.00123456789",makerBuy.buyerFeeBase());
        eq("0.3086419725",makerBuy.sellerFeeQuote());
        eq("1.23333332211",makerBuy.buyerNetBase());
        eq("123.1481470275",makerBuy.sellerNetQuote());
        var makerSell=p.calculate(n("2"),n("20"),Side.SELL);
        eq("0.005",makerSell.buyerFeeBase());
        eq("0.02",makerSell.sellerFeeQuote());
        eq("1.995",makerSell.buyerNetBase());
        eq("19.98",makerSell.sellerNetQuote());
        var dust=p.calculate(n("0.000000000000000001"),n("0.000000000000000001"),Side.BUY);
        eq("0",dust.buyerFeeBase());eq("0",dust.sellerFeeQuote());
        eq("0.000000000000000001",dust.buyerNetBase());
        reject(()->new PaperFeePolicy(-1,10));
        reject(()->new PaperFeePolicy(0,1001));
        reject(()->p.calculate(n("0"),n("20"),Side.BUY));
        reject(()->p.calculate(n("1"),n("20"),null));
        reject(()->p.calculate(n("0.0000000000000000001"),n("1"),Side.BUY));
        System.out.println("PASS Round 007 fee BDD: maker/taker, deterministic floor, dust, negative/scale");
    }
}
