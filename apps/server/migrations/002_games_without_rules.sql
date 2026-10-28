-- CHG-11: Regeltexte haengen an der Spielart (GAME_CONFIG in contracts),
-- nicht am gespeicherten Spiel. Bestehende Inhalte werden bereinigt und die
-- denormalisierte rules-Spalte entfernt.
UPDATE games SET content = content - 'rules';
ALTER TABLE games DROP COLUMN rules;
