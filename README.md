# Venezuela Digital Observatory

Documenting Venezuela's government digital presence through public, structured data.

No exploits. No leaks. No personal data.

As of January 31th, 2026, this dataset includes 2530 `.gob.ve` and `mil.ve` domains.

---

## The problem

There is no public list of Venezuelan government domains.

NIC.VE, the official registry, doesn't publish one. There's no transparency portal, no open data initiative, no API. If you want to know what `.gob.ve` domains exist, you have to guess them one by one and query WHOIS manually.

This opacity makes it nearly impossible for citizens, journalists, or researchers to:
- Know which government websites exist
- Track when new ones are created
- Detect when domains change hands or expire
- Understand the digital footprint of the state

**This repository exists to change that.**

---

## What's here

Structured WHOIS data for `.gob.ve` domains, including:

- Domain name
- Registration and expiration dates
- Last modification date
- Organization (when available)
- Nameservers

---

## Files

```
data/
├── whois_gobve.json    # Full WHOIS dataset
└── whois_gobve.csv     # Spreadsheet-friendly

monitor/
├── index.html          # Live status dashboard
├── status.json         # Current availability data
└── check-status.js     # Status checker script
```

## Live Status Dashboard

Real-time availability monitoring of all `.gob.ve` domains:

**[View Dashboard](https://ggangix.github.io/venezuela-digital-observatory/)**

The dashboard shows:
- Online/offline status for each domain
- HTTP response codes
- SSL certificate status
- Response times

Status is updated periodically via GitHub Actions.

---

## Use cases

- **Journalists**: Investigate when government sites appear or disappear
- **Researchers**: Study digital governance patterns
- **Developers**: Build monitoring tools without scraping opaque systems
- **Citizens**: Hold institutions accountable

---

## Methodology

This is public information—anyone can query it, but nobody had compiled it until now. Personal data has been deliberately removed.

---

## Future scope

This project started with domain WHOIS data and now includes availability monitoring. Future expansions may include:
- DNS changes over time
- TLS/SSL certificate history
- Historical availability trends
- Other observable signals of government digital presence

---

## Self-hosting

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ggangix/venezuela-digital-observatory
   cd venezuela-digital-observatory
   ```

2. **Import data to MongoDB:**
   ```bash
   cd monitor
   npm install
   MONGO_URI=mongodb://localhost:27017/ve_monitor node import-to-mongo.js status.json
   ```

3. **Start the dashboard:**
   ```bash
   cd ../dashboard
   npm install
   npm run dev
   ```

4. **Open** http://localhost:3000

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/ve_monitor` |
| `NEXT_PUBLIC_SITE_URL` | Public URL for meta tags | `https://venezueladigitalobservatory.com` |
| `NEXT_PUBLIC_GA_ID` | Google Analytics ID (optional) | - |

### Docker

```bash
# Build and run
docker-compose up -d

# Or build individually
cd dashboard
docker build -t ve-dashboard .
docker run -p 3000:3000 -e MONGO_URI=mongodb://host:27017/ve_monitor ve-dashboard
```

---

## License

- **Code**: [MIT License](LICENSE)
- **Data** (`data/`, `monitor/status.json`): [CC0 (Public Domain)](https://creativecommons.org/publicdomain/zero/1.0/)

---

## Disclaimer

Independent civic project. Not affiliated with the Venezuelan government or NIC.VE.

Data provided "as is".

---

## Support this work

- Buy me a coffee: [https://buymeacoffee.com/giuseppe.gangi](https://buymeacoffee.com/giuseppe.gangi)

*Documenting systems, not people.*
