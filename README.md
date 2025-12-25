# Property Brokerage Website

A property brokerage website where customers can browse available properties for sale and admins can add/delete listings (login required). Brokers can create, edit and delete properties after approved their property by the admin.

## Features
- **Customer Portal:** Browse properties (houses, apartments, land, etc.) with advanced filtering.
- **Admin Portal:** Manage listings (add/delete), and manage brokers.
- **Broker Portal:** Brokers can register, login, and submit property requests for admin approval.
- **Localization:** Support for English, Amharic, and Tigrinya.
- **Data Persistence:** SQLite database with image storage in `uploads/`.

## Project Structure
```text
├── public/                 # Frontend (HTML, CSS, JS, Locales)
│   ├── index.html          # Customer Home Page
│   ├── admin.html          # Admin Dashboard
│   ├── broker.html         # Broker Portal
│   ├── script.js           # Main Frontend Logic
│   ├── style.css           # Global Styles
│   └── uploads/            # (Served static files)
├── server.js               # Backend (Node.js, Express server & API)
├── database.sqlite         # SQLite Database (Stores houses, brokers, requests)
├── uploads/                # Directory for uploaded property images
└── package.json            # Project dependencies and scripts
```

## Tech Stack
- **Frontend:** HTML, CSS, JavaScript (Vanilla)
- **Backend:** Node.js, Express
- **Database:** SQLite (via `sqlite3`)

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the server:**
   ```bash
   npm start
   ```
   The server will start on [http://localhost:3000](http://localhost:3000)

3. **Access the sites:**
   - **Customer site:** [http://localhost:3000/index.html](http://localhost:3000/index.html)
   - **Admin site:** [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

   - use "admin2905" as a password to acccess the admin panel.

   - **Broker site:** [http://localhost:3000/broker.html](http://localhost:3000/broker.html) or by the link broker dashboard on the customer site.

   - use any username that you want and "290593" as a        password to acccess the broker panel.

4. **Add properties:**
   - Go to the Admin site to add directly.
   - Brokers can submit requests via the Broker site, which Admins must approve.

5. **Delete properties:**
   - On the Admin site, click the Delete button.
   - the brokers can delete their properties if the property is approved by the admin.

## Database schema (SQLite)

### `houses`
- `id` INTEGER PK
- `title`, `description`, `price`, `location`, `city`, `type`, `status`
- `amenities_json` (stored as JSON string)
- `admin_json` (broker info if applicable)

### `house_images`
- `id` INTEGER PK
- `house_id` FK -> `houses.id`
- `filename`

### `brokers`
- `id` INTEGER PK
- `name`, `email`, `phone`, `code`
- `status` (approved/pending)

### `broker_requests`
- `id` INTEGER PK
- `broker_id` FK -> `brokers.id`
- `title`, `description`, `price`
- `status` (pending/approved/rejected)
## Languages (i18n)
- Navbar switcher supports English (EN), Amharic (AM), and Tigrinya (TI).
- Files: `public/i18n/en.json`, `public/i18n/am.json`, `public/i18n/ti.json`.
- Loader: `public/i18n.js` (persists choice in localStorage).
- To translate new text, wrap it with `data-i18n="key"` or use `data-i18n-placeholder` for placeholders and add the key to each JSON.