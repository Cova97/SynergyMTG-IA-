-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "color_identity" TEXT[];

-- AlterTable
ALTER TABLE "decks" ADD COLUMN     "commander_card_id" TEXT;

-- AddForeignKey
ALTER TABLE "decks" ADD CONSTRAINT "decks_commander_card_id_fkey" FOREIGN KEY ("commander_card_id") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
