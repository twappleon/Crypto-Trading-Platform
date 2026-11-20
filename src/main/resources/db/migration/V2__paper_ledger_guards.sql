-- PAPER-ONLY, additive V2; separate statements with -- @statement.
-- These triggers protect journal balance at COMMIT. They do not authorize live funds.
CREATE OR REPLACE FUNCTION paper_assert_balanced_journal()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE journal_key VARCHAR(96);
BEGIN
  IF TG_TABLE_NAME = 'paper_ledger_journals' THEN
    journal_key := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    journal_key := OLD.journal_id;
  ELSE
    journal_key := NEW.journal_id;
  END IF;

  IF EXISTS (SELECT 1 FROM paper_ledger_journals WHERE id = journal_key)
     AND NOT EXISTS (
       SELECT 1 FROM paper_ledger_entries WHERE journal_id = journal_key
       GROUP BY journal_id HAVING COUNT(*) >= 2 AND SUM(delta) = 0
     ) THEN
    RAISE EXCEPTION 'unbalanced or incomplete paper journal: %', journal_key
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
-- @statement
DROP TRIGGER IF EXISTS paper_check_new_journal ON paper_ledger_journals;
-- @statement
CREATE CONSTRAINT TRIGGER paper_check_new_journal
AFTER INSERT ON paper_ledger_journals
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION paper_assert_balanced_journal();
-- @statement
DROP TRIGGER IF EXISTS paper_check_new_entry ON paper_ledger_entries;
-- @statement
CREATE CONSTRAINT TRIGGER paper_check_new_entry
AFTER INSERT ON paper_ledger_entries
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION paper_assert_balanced_journal();
-- @statement
CREATE OR REPLACE FUNCTION paper_reject_journal_rewrite()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'paper journal history is append-only'
    USING ERRCODE = '55000';
END;
$$;
-- @statement
DROP TRIGGER IF EXISTS paper_entries_append_only ON paper_ledger_entries;
-- @statement
CREATE TRIGGER paper_entries_append_only
BEFORE UPDATE OR DELETE ON paper_ledger_entries
FOR EACH ROW EXECUTE FUNCTION paper_reject_journal_rewrite();
-- @statement
DROP TRIGGER IF EXISTS paper_journals_append_only ON paper_ledger_journals;
-- @statement
CREATE TRIGGER paper_journals_append_only
BEFORE UPDATE OR DELETE ON paper_ledger_journals
FOR EACH ROW EXECUTE FUNCTION paper_reject_journal_rewrite();
