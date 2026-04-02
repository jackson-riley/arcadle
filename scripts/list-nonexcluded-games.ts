import { getNonExcludedCatalogEntries } from "../lib/games";

for (const g of getNonExcludedCatalogEntries()) {
  console.log(g.title);
}
