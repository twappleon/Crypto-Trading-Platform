package exchange;
import java.math.BigDecimal;
import java.util.Map;
import static exchange.ExchangeCore.*;
/** Runnable BDD contract. No third-party dependencies. */
public final class ExchangeCoreBDD {
 static BigDecimal d(String x){return new BigDecimal(x);}
 static void ok(boolean x,String context){if(!x)throw new AssertionError(context);}
 static void rejects(Runnable r){try{r.run();throw new AssertionError("expected rejection");}catch(IllegalArgumentException|IllegalStateException expected){}}
 public static void main(String[] args){
  Book book=new Book();
  Order sell=book.submit("seller",Side.SELL,d("100"),d("2"));
  Order buy=book.submit("buyer",Side.BUY,d("101"),d("1.5"));
  ok(book.trades().size()==1,"one trade");
  ok(book.trades().get(0).price().compareTo(d("100"))==0,"maker price");
  ok(sell.remaining.compareTo(d("0.5"))==0&&sell.status==Status.PARTIAL,"partial fill");
  ok(buy.status==Status.FILLED,"filled buy");
  Book fifo=new Book();
  Order first=fifo.submit("a",Side.SELL,d("10"),d("1"));
  fifo.submit("b",Side.SELL,d("10"),d("1"));
  fifo.submit("c",Side.BUY,d("10"),d("1"));
  ok(fifo.trades().get(0).sellOrderId()==first.id,"price time priority");
  rejects(()->fifo.cancel(2,"attacker"));
  fifo.cancel(2,"b");ok(fifo.asks().isEmpty(),"cancel removed order");
  rejects(()->fifo.submit("x",Side.BUY,d("0"),d("1")));
  rejects(()->fifo.submit("x",Side.BUY,d("1"),d("-1")));
  Ledger l=new Ledger();
  l.creditForTest("f1","alice","USDC",d("100"));
  l.transfer("t1","alice","bob","USDC",d("40"));
  l.transfer("t1","alice","bob","USDC",d("40"));
  ok(l.balance("alice","USDC").compareTo(d("60"))==0,"debit once");
  ok(l.balance("bob","USDC").compareTo(d("40"))==0,"credit once");
  rejects(()->l.transfer("t1","alice","bob","USDC",d("30")));
  rejects(()->l.transfer("t2","alice","bob","USDC",d("61")));
  ok(l.balance("alice","USDC").compareTo(d("60"))==0,"no partial overdraft");
  rejects(()->l.post("bad","USDC",Map.of("alice",d("1"),"bob",d("1"))));
  Book self=new Book();self.submit("same",Side.SELL,d("10"),d("1"));
  rejects(()->self.submit("same",Side.BUY,d("10"),d("1")));
  Book multi=new Book();multi.submit("a",Side.SELL,d("10"),d("1"));multi.submit("same",Side.SELL,d("11"),d("1"));
  rejects(()->multi.submit("same",Side.BUY,d("11"),d("2")));
  ok(multi.trades().isEmpty()&&multi.asks().size()==2,"no partial mutation on STP rejection");
  System.out.println("PASS: matching, FIFO, cancellation, validation, STP and ledger BDD");
 }
}
