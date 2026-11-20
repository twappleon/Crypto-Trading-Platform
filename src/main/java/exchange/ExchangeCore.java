package exchange;
import java.math.BigDecimal;
import java.util.*;
/** In-memory paper-only order book and balanced ledger prototype. No real funds. */
public final class ExchangeCore {
 private ExchangeCore(){}
 public enum Side { BUY, SELL }
 public enum Status { OPEN, PARTIAL, FILLED, CANCELED }
 public record Trade(long buyOrderId,long sellOrderId,BigDecimal price,BigDecimal quantity){}
 public static final class Order {
  public final long id; public final String owner; public final Side side; public final BigDecimal price;
  public final BigDecimal quantity; public BigDecimal remaining; public Status status=Status.OPEN;
  Order(long id,String owner,Side side,BigDecimal price,BigDecimal qty){
   this.id=id;this.owner=owner;this.side=side;this.price=price;quantity=qty;remaining=qty;
  }
 }
 public static final class Book {
  private long sequence=1;
  private final List<Order> bids=new ArrayList<>(),asks=new ArrayList<>();
  private final Map<Long,Order> orders=new HashMap<>();
  private final List<Trade> trades=new ArrayList<>();
  public synchronized Order submit(String owner,Side side,BigDecimal price,BigDecimal qty){
   if(owner==null||owner.isBlank()||side==null||price==null||qty==null||price.signum()<=0||qty.signum()<=0)
    throw new IllegalArgumentException("invalid limit order");
   List<Order> opposite=side==Side.BUY?asks:bids;
   BigDecimal simulated=qty;
   for(Order maker:opposite) {
    if(simulated.signum()==0)break;
    boolean crosses=side==Side.BUY?price.compareTo(maker.price)>=0:price.compareTo(maker.price)<=0;
    if(!crosses)break;
    if(owner.equals(maker.owner))throw new IllegalArgumentException("self-trade prevented");
    simulated=simulated.subtract(simulated.min(maker.remaining));
   }
   Order incoming=new Order(sequence++,owner,side,price,qty);orders.put(incoming.id,incoming);
   while(incoming.remaining.signum()>0&&!opposite.isEmpty()){
    Order maker=opposite.get(0);
    boolean crosses=side==Side.BUY?price.compareTo(maker.price)>=0:price.compareTo(maker.price)<=0;
    if(!crosses)break;
    BigDecimal filled=incoming.remaining.min(maker.remaining);
    incoming.remaining=incoming.remaining.subtract(filled);
    maker.remaining=maker.remaining.subtract(filled);
    trades.add(new Trade(side==Side.BUY?incoming.id:maker.id,side==Side.SELL?incoming.id:maker.id,maker.price,filled));
    maker.status=maker.remaining.signum()==0?Status.FILLED:Status.PARTIAL;
    if(maker.remaining.signum()==0)opposite.remove(0);
   }
   incoming.status=incoming.remaining.signum()==0?Status.FILLED:incoming.remaining.compareTo(qty)<0?Status.PARTIAL:Status.OPEN;
   if(incoming.remaining.signum()>0){
    List<Order> own=side==Side.BUY?bids:asks;own.add(incoming);
    own.sort((a,b)->{int p=side==Side.BUY?b.price.compareTo(a.price):a.price.compareTo(b.price);return p!=0?p:Long.compare(a.id,b.id);});
   }
   return incoming;
  }
  public synchronized void cancel(long id,String owner){
   Order o=orders.get(id);
   if(o==null||owner==null||!o.owner.equals(owner)||o.remaining.signum()==0||o.status==Status.CANCELED)
    throw new IllegalArgumentException("cannot cancel");
   o.status=Status.CANCELED;(o.side==Side.BUY?bids:asks).remove(o);
  }
  public synchronized List<Trade> trades(){return List.copyOf(trades);}
  public synchronized List<Order> bids(){return List.copyOf(bids);}
  public synchronized List<Order> asks(){return List.copyOf(asks);}
 }
 public static final class Ledger {
  private final Map<String,BigDecimal> balances=new HashMap<>();
  private final Map<String,String> posted=new HashMap<>();
  private static String key(String account,String asset){return account+":"+asset;}
  public synchronized BigDecimal balance(String account,String asset){return balances.getOrDefault(key(account,asset),BigDecimal.ZERO);}
  public synchronized void post(String id,String asset,Map<String,BigDecimal> changes){
   if(id==null||id.isBlank()||asset==null||asset.isBlank()||changes==null||changes.isEmpty()||changes.values().stream().anyMatch(Objects::isNull))
    throw new IllegalArgumentException("invalid journal");
   String fingerprint=asset+":"+new TreeMap<>(changes);
   if(posted.containsKey(id)){
    if(!posted.get(id).equals(fingerprint))throw new IllegalArgumentException("idempotency conflict");
    return;
   }
   if(changes.values().stream().reduce(BigDecimal.ZERO,BigDecimal::add).signum()!=0)throw new IllegalArgumentException("unbalanced journal");
   for(var entry:changes.entrySet())
    if(!entry.getKey().equals("treasury")&&balance(entry.getKey(),asset).add(entry.getValue()).signum()<0)
     throw new IllegalStateException("insufficient funds");
   changes.forEach((a,v)->balances.put(key(a,asset),balance(a,asset).add(v)));
   posted.put(id,fingerprint);
  }
  public synchronized void creditForTest(String id,String account,String asset,BigDecimal amount){
   if(amount==null||amount.signum()<=0||account.equals("treasury"))throw new IllegalArgumentException("invalid credit");
   post(id,asset,Map.of("treasury",amount.negate(),account,amount));
  }
  public synchronized void transfer(String id,String from,String to,String asset,BigDecimal amount){
   if(from==null||to==null||from.equals(to)||from.equals("treasury")||to.equals("treasury")||amount==null||amount.signum()<=0)
    throw new IllegalArgumentException("invalid transfer");
   post(id,asset,Map.of(from,amount.negate(),to,amount));
  }
 }
}
