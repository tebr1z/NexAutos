# Chrome Web Store listing

## Name

Auto Nex – BidCars Market Analysis

## Short description

Analyze BidCars final sales by make, model, trim, engine, fuel and auction; estimate Baku delivery cost.

## Detailed description

Auto Nex Market Analysis reads finalized and archived vehicle listings that you open on BidCars. It organizes public auction results by make, model, trim, model year, engine displacement, fuel type, mileage, color and auction house.

Select a make, model, trim such as SE, SEL or Limited, and an engine size to see only matching final sales. The extension shows the median, average and the middle 25–75% sale-price range. When Auto Nex API access is configured, it can also estimate auction fees, transport, customs and Baku delivery cost.

Collected results are retained locally for 30 days. If the owner configures an Auto Nex collector key, the same public listing data can be synchronized to their private Auto Nex PostgreSQL database.

This extension is an independent analysis tool and is not affiliated with BidCars, Copart or IAAI. Estimates are informational and are not a purchase-price guarantee.

## Category

Productivity

## Permission justification

- `storage`: keeps the 30-day local market dataset, API address and collector key.
- `activeTab` and `scripting`: opens/toggles the analysis panel on the BidCars tab selected by the user.
- `bid.cars` host access: reads public finalized vehicle information visible on BidCars pages.
- `nex.autos` host access: requests transport/customs estimates and optionally synchronizes public sale records.

## Assets

- Store icon: `../autonex-bidcars-market/icons/icon128.png`
- Small promo tile: `small-promo-440x280.png`
- Screenshot: `screenshot-1280x800.png`

## Recommended language

Azerbaijani (`az`) as primary; English listing copy above can be used as an additional locale.
