package exchange;
import org.junit.jupiter.api.Test;
class CoreBDDTest {
    @Test void inMemoryPrototype() { ExchangeCoreBDD.main(new String[0]); }
    @Test void paperLedgerInputValidation() { PostgresLedgerValidationBDD.main(new String[0]); }
}
