# QR Menu - Restaurant Digital Menu System

A contactless digital menu system built with React and Vite. Customers scan QR codes to browse menus and place orders from their phones.

## 🚀 Live Demo

**Production**: [https://ramadevi922.github.io/QRMENU/](https://ramadevi922.github.io/QRMENU/)

## ✨ Features

- **Customer Menu**: Scan QR code to view menu and place orders
- **Admin Panel**: Manage menu items, tables, and track orders (Clerk authentication)
- **Waiter Panel**: Receive real-time order notifications
- **Real-time Updates**: Menu changes reflect immediately
- **Responsive Design**: Works on all devices

## 🛠️ Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui Components
- Clerk Authentication
- Zustand (State Management)
- React Router
- Tanstack Query

## 📋 Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/RAMADEVI922/QRMENU.git
cd QRMENU
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env.local` file in the root directory:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_bWludC13b21iYXQtNTIuY2xlcmsuYWNjb3VudHMuZGV2JA

# Firebase configuration (replace with your own values)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

### 4. Firebase Setup (optional)

1. Create a project at https://console.firebase.google.com/
2. In Project Settings → Your apps, register a web app and copy the config values.
3. Paste those values into your `.env.local` file.

You can now import Firebase helpers from `src/lib/firebase.ts`:

```ts
import { auth, db } from "./lib/firebase";
```


### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173/QRMENU/`

## 📁 Project Structure

```
QRMENU/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── ui/          # shadcn/ui components
│   │   ├── NavLink.tsx
│   │   └── ProtectedRoute.tsx
│   ├── pages/           # Page components
│   │   ├── Index.tsx
│   │   ├── CustomerMenu.tsx
│   │   ├── AdminPanel.tsx
│   │   ├── AdminLogin.tsx
│   │   ├── AdminSignUp.tsx
│   │   └── WaiterPanel.tsx
│   ├── store/           # Zustand state management
│   │   ├── authStore.ts
│   │   └── restaurantStore.ts
│   ├── lib/             # Utility functions
│   ├── App.tsx
│   └── main.tsx
├── public/              # Static assets
├── .github/workflows/   # GitHub Actions CI/CD
└── package.json
```

## 🔐 Authentication

This project uses [Clerk](https://clerk.com/) for admin authentication:

- Admin login and signup pages use Clerk components
- Protected routes require authentication
- Secure session management

## 🚢 Deployment

The project is automatically deployed to GitHub Pages using GitHub Actions.

### Manual Deployment

```bash
npm run build
```

The build output will be in the `dist/` directory.

## 👥 Collaboration Guide

### For Repository Owner

1. Go to repository Settings → Collaborators
2. Click "Add people"
3. Enter collaborator's GitHub username
4. Select permission level (Write recommended)
5. Send invitation

### For Collaborators

1. Accept the GitHub invitation email
2. Clone the repository
3. Install dependencies: `npm install`
4. Create `.env.local` with the Clerk key
5. Start development: `npm run dev`

### Git Workflow

```bash
# Pull latest changes
git pull origin main

# Create a feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "Description of changes"

# Push to GitHub
git push origin feature/your-feature-name

# Create Pull Request on GitHub for review
```

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🔧 Configuration

### Vite Config

The base path is set to `/QRMENU/` for GitHub Pages deployment. Update `vite.config.ts` if deploying elsewhere.

### Clerk Setup

1. Create account at [clerk.com](https://clerk.com/)
2. Get your Publishable Key from the dashboard
3. Add to `.env.local`
4. Add as GitHub secret for deployment: `VITE_CLERK_PUBLISHABLE_KEY`

## 🐛 Troubleshooting

### Port Already in Use

Vite automatically finds the next available port. Default is 5173.

### Clerk Authentication Not Working

- Verify `.env.local` has the correct key
- Check GitHub secrets are configured
- Ensure URLs include `/QRMENU/` base path

### Build Fails

- Clear node_modules: `rm -rf node_modules && npm install`
- Clear cache: `rm -rf dist`
- Check Node.js version: `node --version` (should be 18+)

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

Built with ❤️ using React and Vite
