# Property Rehab & ARV Estimator — SaaS

AI damage detection (Roboflow) + Zillow (RapidAPI) + Rehab/ARV calc + Supabase reports.

## Run locally
```bash
npm install
npm run dev
```

## Environment Variables

The application requires the following environment variables to be set in a `.env.local` file:

### Required
- `RAPIDAPI_KEY` - Your RapidAPI key for accessing Zillow data endpoints

### Optional (Zillow Configuration)
- `RAPIDAPI_HOST` - RapidAPI host for Zillow endpoint (default: `real-time-zillow-data.p.rapidapi.com`)
  - Alternative hosts: `zillow-working-api.p.rapidapi.com`, `real-time-zillow-data.p.rapidapi.com`
- `RAPIDAPI_ADDRESS_PATH` - API endpoint path for address lookup (default: `/property-details-address`)
  - Alternative paths: `/byaddress`, `/custom_ag/byaddress`

### Example `.env.local`
```bash
RAPIDAPI_KEY=your_api_key_here

# Optional: Use alternative RapidAPI Zillow product
# RAPIDAPI_HOST=zillow-working-api.p.rapidapi.com
# RAPIDAPI_ADDRESS_PATH=/byaddress
```

**Note:** The environment variables `RAPIDAPI_HOST` and `RAPIDAPI_ADDRESS_PATH` allow you to switch between different RapidAPI Zillow products without code changes. If not specified, the application defaults to `real-time-zillow-data.p.rapidapi.com` and `/property-details-address`.
