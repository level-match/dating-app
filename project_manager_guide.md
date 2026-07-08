# LEVEL — Project Manager's Tech Stack Guide

This is a high-level, business-friendly guide designed for the Project Manager. It outlines the technologies used, their purpose, and the third-party services we rely on for features like security, payments, OTP verification, and photo storage.

---

## 🏛️ System Architecture: The Simple Picture

The application is split into three main parts:
1.  **The Frontend (Client Side)**: The visual screens and buttons the user interacts with (onboarding forms, browse screen, chat window, profile setup).
2.  **The Backend (Server Side)**: The brain that runs in the background. It handles payment math, processes tier upgrades/downgrades, and operates the admin dashboard.
3.  **The Database**: The digital filing cabinet storing profile answers, matches, transactions, and audit records.

---

## 🛠️ The Core Technology Stack

Here is what we used to build the app and why:

| Component | Technology | What it does (Plain English) | Why we chose it |
| :--- | :--- | :--- | :--- |
| **Frontend** | **React** + **Vite** | The framework for building interactive user interfaces. | Allows screens to load instantly and updates without refreshing the entire page. |
| **Styling & Visuals** | **Tailwind CSS** | Styling engine for designing pages. | Speeds up screen development; ensures a sleek, cohesive, and modern look. |
| **Backend API** | **Node.js** + **Express** | The coordinator between the frontend, database, and payments. | Highly reliable, fast, and handles thousands of simultaneous users efficiently. |
| **Database** | **PostgreSQL** | The secure storage system for app data. | Industry standard for secure transactions and complex matchmaking queries. |

---

## 🔌 3rd Party Integrations & Services (Action Items for PM)

To run the application in production, we connect to external services. The project manager/owner will need to set up accounts for the following services:

### 1. 🔑 User Login & Security (OTP)
To sign up, verify, and authenticate users securely:
*   **Primary Engine: Supabase Auth**
    *   *What it does*: Manages user login sessions, Google social login, and handles the backend logic of security tokens.
*   **SMS Delivery: Twilio** (or **Vonage/Nexmo**)
    *   *What it does*: Supabase Auth forwards verification requests to this SMS gateway, which delivers the text messages containing the One-Time Password (OTP) to the user's phone.
    *   *Action Item*: We need a **Twilio API Account** with SMS credits.

### 2. 🖼️ File & Image Storage
Dating apps are highly visual. Users need to upload high-quality profile photos:
*   **Storage Host: Supabase Storage** (or **Amazon S3**)
    *   *What it does*: A secure, cloud-based bucket that stores user-uploaded photos and generates quick-loading links to display on profile cards.
*   **Optional Optimization: Cloudinary**
    *   *What it does*: Automatic image compression, resizing, and caching so profile pages load fast even on slower mobile networks.
    *   *Action Item*: Enable **Supabase Storage** (free tier/pay-as-you-go) or set up a dedicated **Cloudinary** account.

### 3. 💳 Payment Processing & Subscriptions
Handling premium memberships (`Base`, `Plus`, and `Prime` packages):
*   **Local Payments: PayMongo**
    *   *What it does*: Processes local payment channels including GCash, Maya, local bank transfers, and credit cards.
    *   *Action Item*: Register a verified merchant account at **PayMongo**.
*   **International Payments: Stripe**
    *   *What it does*: Backup payment processor primarily configured for international credit card payments.
    *   *Action Item*: Set up a **Stripe Developer Account**.

---

## 💼 Key Takeaways for the PM
*   **Security Built-In**: All database connections and user data use enterprise-grade encryption.
*   **Development Speed**: Includes a "Demo Mode" so you can inspect the screens and onboarding steps locally without needing a live database or paying for Twilio SMS codes during testing.
*   **Next Steps**: Register accounts for **Supabase**, **Twilio** (for OTP), and **PayMongo** (for GCash/payment integrations) to move from testing to a live staging environment.
