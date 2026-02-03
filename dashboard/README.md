# Venezuela Digital Observatory - Dashboard

Real-time monitoring dashboard for Venezuelan government websites (.gob.ve).

## Features

- **Bilingual**: English and Spanish support
- **Real-time stats**: Online/offline status, SSL certificates, response times
- **Domain search**: Filter and search across 2,500+ domains
- **Historical trends**: Track availability over time
- **Data export**: Download data in JSON or CSV format
- **Domain requests**: Submit new domains to be monitored

## Tech Stack

- [Next.js 15](https://nextjs.org/) - React framework
- [next-intl](https://next-intl-docs.vercel.app/) - Internationalization
- [MongoDB](https://www.mongodb.com/) - Database
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Recharts](https://recharts.org/) - Charts
- [Zod](https://zod.dev/) - Validation

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB instance with ve_monitor data
- (Optional) Google Analytics ID
- (Optional) reCAPTCHA keys

### Installation

```bash
# Clone the repository
git clone https://github.com/giuseppegangi/venezuela-digital-observatory.git

# Navigate to dashboard directory
cd venezuela-digital-observatory/dashboard

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your values
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

### Docker

```bash
# Build image
docker build -t ve-dashboard .

# Run container
docker run -p 3000:3000 \
  -e MONGO_URI=mongodb://... \
  ve-dashboard
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | Yes | MongoDB connection string |
| `NEXT_PUBLIC_SITE_URL` | No | Site URL for SEO |
| `NEXT_PUBLIC_GA_ID` | No | Google Analytics 4 ID |
| `RECAPTCHA_SECRET_KEY` | No | reCAPTCHA v2 secret key |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | No | reCAPTCHA v2 site key |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/monitor/summary` | Latest check summary |
| `GET /api/monitor/domains` | Paginated domain list |
| `GET /api/monitor/domains/[name]` | Single domain details |
| `GET /api/monitor/trends` | Historical trends |
| `GET /api/monitor/export` | Export data (JSON/CSV) |
| `POST /api/monitor/request` | Submit domain request |

## License

Data: CC0 - Public Domain
Code: MIT License

## Author

[Giuseppe Gangi](https://ggangi.com)

- Twitter: [@giuseppegangi](https://twitter.com/giuseppegangi)
- GitHub: [@giuseppegangi](https://github.com/giuseppegangi)
- LinkedIn: [giuseppegangi](https://linkedin.com/in/giuseppegangi)

## Support

If you find this project useful, consider [buying me a coffee](https://buymeacoffee.com/giuseppegangi)!
