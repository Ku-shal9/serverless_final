# Photo Galli

AI-powered image generator with user authentication, rate limiting, and a retro-themed interface. Users can generate images from text prompts using Hugging Face models via a backend API (designed for AWS ECS) or Puter.ai as a fallback.

---

## Features

- **Image generation**: Text-to-image via Hugging Face (FLUX, SDXL, Stable Diffusion) or Puter.ai
- **Authentication**: User and admin roles, guest mode, sign up, OTP-based password reset via EmailJS
- **Rate limiting**: Per-user generation limits (guest: 2, free: 6, configurable for paid plans)
- **Gallery**: Save generated images, view in Photos page, download, delete
- **Prompt history**: Sidebar with searchable history, click to reuse prompts
- **Admin panel**: User management, rate limit adjustment, prompt/gallery inspection
- **Theme**: Dark/light mode with localStorage persistence
- **Responsive layout**: Mobile-friendly navbar, collapsible sidebar

---

## Tech Stack

| Layer     | Technology                                                             |
| --------- | ---------------------------------------------------------------------- |
| Frontend  | HTML5, CSS3, Vanilla JavaScript                                        |
| Styling   | Bootstrap 5 (grid/utilities), custom modular CSS                       |
| Auth      | localStorage-based session, EmailJS for OTP emails                     |
| Image API | Hugging Face Inference API (via ECS backend API), Puter.ai (fallback) |
| Hosting   | Frontend: Vercel (static) • Backend: AWS ECS (API)                    |

---

## Screenshots

### Image Generation Page

![Image Generation](./image/Photo%20Galli-Image%20Generation.png)

### Sign In Page

![Sign In Page](./image/Photo%20Galli-Sign%20In%20page.png)

---

## Project Structure

```
AI_Image_Generator/
|-- index.html              # Home page
|-- html/
|   |-- signin.html
|   |-- about.html
|   |-- photos.html
|   |-- pricing.html
|   |-- admin.html
|-- css/
|   |-- style.css           # Main entry (imports all modules)
|   |-- vars.css            # CSS variables, fonts
|   |-- base.css            # Reset, body, light mode
|   |-- navbar.css
|   |-- layout.css
|   |-- sidebar.css
|   |-- cards.css
|   |-- forms.css
|   |-- buttons.css
|   |-- loading.css
|   |-- alerts.css
|   |-- image.css
|   |-- profile.css
|   |-- gallery.css
|   |-- modal.css
|   |-- auth.css
|   |-- about.css
|   |-- admin.css
|   |-- sections.css
|   |-- rate.css
|   |-- utils.css
|   |-- effects.css
|   |-- footer.css
|   |-- payment.css
|   |-- guest.css
|   |-- anims.css
|   |-- sidebar-btns.css
|   |-- responsive.css
|-- js/
|   |-- auth-const.js       # Constants, seed, user CRUD
|   |-- auth-session.js     # Session management
|   |-- auth-guest.js       # Guest mode
|   |-- auth-core.js        # Sign in/out, rate limit, history, gallery
|   |-- auth-theme.js       # Theme toggle
|   |-- auth-nav.js         # Guards, redirects, navbar
|   |-- auth-profile.js     # Profile picture, password change
|   |-- auth-user.js        # Username, email, admin reset
|   |-- auth-otp.js         # OTP, EmailJS
|   |-- auth.js             # Init (seed)
|   |-- app-dom.js          # DOM refs, HF config
|   |-- app-main.js         # Generate, UI, profile modal
|   |-- app.js              # Home page init
|   |-- gallery.js          # Photos page
|   |-- admin.js            # Admin panel
|-- backend/
|   |-- server.js               # Express API (ECS-ready)
|   |-- src/
|       |-- routes.js             # API endpoints (auth/db/HF proxy)
|-- README.md
```

---

## Prerequisites

- Node.js 18+
- Vercel account (for deployment)
- Hugging Face account (for HF_TOKEN)
- EmailJS account (for OTP password reset)

---

## Installation

1. Clone the repository:

   ```
   git clone <repository-url>
   cd AI_Image_Generator
   ```

2. Open `index.html` in a browser, or serve the folder with any static server (e.g. Live Server, `python -m http.server`).

3. For full image generation locally (Hugging Face), run the backend locally:
   ```
   cd backend
   npm install
   npm run dev
   ```
   Then open the frontend with a static server and set `window.PG_API_BASE` to your backend URL.

---

## Environment Variables

Configure these in Vercel Project Settings > Environment Variables:

| Variable     | Description                            | Required                |
| ------------ | -------------------------------------- | ----------------------- |
| HF_TOKEN     | Hugging Face API token (read)          | Backend only            |
| DATABASE_URL | Neon Postgres connection string        | Backend only            |
| CORS_ORIGINS | Allowed frontend origins (comma list)  | Backend only            |

EmailJS credentials are in `auth-const.js` (service ID, template ID, public key). For production, consider moving these to environment variables.

---

## Deployment

### Frontend (Vercel)

- Deploy the static site (this repo root).
- Set `window.PG_API_BASE` in the HTML to your ECS backend URL.

### Backend (AWS ECS)

- Deploy `backend/` as a container on ECS.
- Configure backend env vars: `HF_TOKEN`, `DATABASE_URL`, `CORS_ORIGINS`, `PORT`.

---

## Default Credentials

| Role  | Username | Password |
| ----- | -------- | -------- |
| Admin | admin    | admin123 |
| User  | demo     | demo123  |

---

## Local vs Production Behavior

- **On Vercel**: the frontend calls your ECS backend (e.g. `https://api.example.com/generate-image`). If that fails, Puter.ai is used as fallback.
- **On localhost**: If the server route is unavailable, the app falls back to Puter.ai. To test Hugging Face locally, run `vercel dev`.

---

## Modular Design

- **CSS**: `style.css` imports 26 modular files (vars, base, navbar, layout, sidebar, cards, forms, buttons, etc.). Each file has a short comment describing its scope.
- **JavaScript**: Auth logic is split into 10 modules (`auth-const`, `auth-session`, `auth-guest`, etc.); app logic into 3 (`app-dom`, `app-main`, `app`). Load order is defined in each HTML page.

---

## License

All rights reserved.
