# Axial Studios — LLC + Apple Developer Setup

## Step 1: Register Axial Studios LLC in Minnesota
- **Site:** sos.state.mn.us (Minnesota Secretary of State)
- **Fee:** $155 online filing
- **Timeline:** ~3–5 business days
- **Annual renewal:** $0 (just file a free renewal by Dec 31 each year)
- Save the Certificate of Organization PDF when it arrives

## Step 2: Get an EIN from the IRS (free, instant)
- **Site:** irs.gov → "Apply for an EIN Online"
- Do this the same day you file the LLC
- Takes ~10 minutes, free, no waiting

## Step 3: Create a new Apple ID for Axial Studios
- Go to appleid.apple.com and create a brand new Apple ID using axialstudios.dev@gmail.com
- This is completely free — no iCloud storage, no subscriptions, nothing extra
- This Apple ID is ONLY used for developer/publishing purposes
- Your personal Apple ID (iCloud, family plan, iPhone, MacBook) is never touched

## Step 4: Enroll in Apple Developer Program (individual)
- **Site:** developer.apple.com → Enroll → Individual
- Sign in with the new Axial Studios Apple ID (NOT your personal one)
- **Fee:** $99/year
- App publishes under "Carson Lane" temporarily — that's the legal name, not your email
- Your personal iCloud has zero involvement

## Step 5: Apply for a DUNS Number (free)
- **Site:** dnb.com → request a DUNS number
- **Cost: $0** — skip the $229 expedited option, not worth it
- **Timeline:** up to 30 business days — starts the clock now, runs in background
- You'll need: "Axial Studios LLC", Minnesota address, EIN, phone number
- Start this as soon as the LLC is approved

## Step 6: Convert Apple account to Organization (no second fee)
- Once DUNS arrives, contact Apple Developer Support via the Contact Us form:
  developer.apple.com/contact/
- Request conversion of individual account to organization account
- Provide: Axial Studios LLC legal name, DUNS number, authority to act for org
- Account name updates to "Axial Studios LLC", all apps carry over
- **No second $99 fee** — same account, same membership, just upgraded

## Publishing the App (Expo/React Native — no Xcode needed)
Because AI Hunter is built with Expo, you publish using EAS (Expo Application Services) 
entirely from the command line — no local Xcode install, no macOS update required.

```
eas build --platform ios    # builds in the cloud
eas submit --platform ios   # submits directly to App Store
```

Your current codebase is already structured for this. The code you have now is the 
code that ships. When you're ready, just install eas-cli and log in with the Axial 
Studios Apple ID.

## Adding Your iPhone as a Test Device
- In App Store Connect, register your iPhone's UDID as a test device
- This does NOT change your personal Apple ID on your phone
- It just tells Apple "this device is allowed to run test builds"
- Your iCloud, family plan, and personal Apple ID are completely unaffected

## Total Cost
| Item | Cost |
|---|---|
| Minnesota LLC | $155 |
| EIN | $0 |
| New Apple ID (Axial Studios) | $0 |
| DUNS number | $0 |
| Apple Developer account | $99 |
| **Total** | **$254** |

## Realistic Timeline
- LLC + Apple account: start today, both active within ~1 week
- DUNS: ~30 business days (free) — runs in background
- Org conversion: a few days after DUNS arrives
- **App live under "Carson Lane": within ~1–2 weeks**
- **Name switches to "Axial Studios LLC": ~7–8 weeks from today**

## Android / Google Play Store
Same codebase, second platform. Expo/React Native builds for both iOS and Android from 
the same code — no separate app to maintain.

- **Google Play registration:** One-time $25 fee (never annual, unlike Apple's $99/yr)
- **Review time:** Much faster than Apple — often same day
- **Code changes:** Minimal to none for a standard Expo app
- **Build + submit:** `eas build --platform android` → `eas submit --platform android`

**Plan:** Launch iOS first, get it stable, then submit Android. Probably a week of 
verification that everything looks right on Android, then submit. Both stores covered 
with essentially zero extra code.

## Total Cost (Both Platforms)
| Item | Cost |
|---|---|
| Minnesota LLC | $155 |
| EIN | $0 |
| New Apple ID (Axial Studios) | $0 |
| DUNS number | $0 |
| Apple Developer account | $99 |
| Google Play registration | $25 |
| **Total** | **$279** |

## Notes
- Minnesota is the right state — no reason to file in Delaware unless raising VC money
- App Store review per app: ~24–48 hrs (Apple), same day (Google)
- Apple requires the org to be a real LLC or corporation — sole proprietor/DBA not accepted
- Revenue earned during individual → org transition is fine; carries over automatically
