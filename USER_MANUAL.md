# CHara Realty — Admin User Manual

Welcome to the CHara Realty Administration System. This guide is designed for the data entry and administrative team to understand how to effectively manage properties, track client inquiries, construct developer payment schemes, and update deals.

> [!IMPORTANT]
> **Before You Begin:** Ensure you have your login credentials. By default, the admin portal is accessed by navigating to `/admin/login` on the website (e.g., `http://localhost:5173/admin/login` or your live URL).

---

## Table of Contents
1. [Admin Dashboard Overview](#1-admin-dashboard-overview)
2. [Managing Properties](#2-managing-properties)
    * Adding Basic Info & Media
    * Using the Payment Schemes Builder
    * Sales, Legal, and Admin Details
3. [Managing Clients & Deals](#3-managing-clients--deals)
4. [Handling Inquiries](#4-handling-inquiries)
5. [Archives & Soft Deletes](#5-archives--soft-deletes)

---

## 1. Admin Dashboard Overview

Upon logging in, you will land on the **Dashboard**. This is your command center.
* **Quick Metrics:** Look at the top cards to see your total unread inquiries, active deals, and total property listings.
* **Navigation Sidebar:** The left menu is your primary method for moving between Properties, Clients, Inquiries, Deals, and the Archives.

---

## 2. Managing Properties

This is where you will spend most of your time doing data entry. 

To add or edit a property, go to the **Properties** tab and click the **+ Add Property** button. This opens a large multi-tab form.

> [!TIP]
> You do not need to fill out every single field at once. You can save your progress and edit the property again later.

### Tab 1: Basic
* **Location & Title:** Set the internal title, developer name, property type (e.g., House & Lot, Condo), and location specifics (City, Province).
* **Specs:** Input bedrooms, bathrooms, floor area, and lot area.

### Tab 2: Media
* **Cover Image:** The primary photo shown on the public website.
* **Gallery:** Upload multiple high-quality images. The system will automatically compress and optimize them.
* **Floor Plan:** Specific image highlighting the unit's layout.

### Tab 3: Schemes (Payment Options)
Because CHara Realty works with multiple developers, each with unique pricing models, we use a flexible **Payment Scheme Builder**. 

1. Click **+ Add Payment Option** (e.g., "10% DP – Pag-IBIG").
2. **Payment Line Items:** Build the computation sheet line-by-line exactly as the developer provides it.
   * `+ Fixed ₱`: A hardcoded peso amount. (Use negative numbers for discounts/deductions).
   * `+ % of above`: Percentage applied against the *most recent subtotal*.
   * `+ Subtotal ↵`: Auto-sums all the rows above it. **Crucial:** Always add a Subtotal row before the financing balance!
   * `+ Instalment`: Enter the total amount and number of months. The system calculates the monthly payment.
3. **Financing Terms:** Add rows for bank loans or Pag-IBIG. Input the Institution, Term (Years), and Interest Rate. 
   * *Magic Feature:* The system uses a PMT formula to automatically calculate your exact Monthly Amortization!

### Tab 4: Sales
* **Status:** Draft, Available, Sold out, or Archived. (Set to "Available" for the public to see it).
* **Promo Pricing:** If the developer runs a promo, enter the discount here. The system will auto-calculate the Net Price.

### Tab 5: Legal & Documents
* **Titles:** TCT/CCT data and developer licenses (LTS Number).
* **Document Uploads:** Securely attach the *Contract*, *Reservation Form*, and *Title Copy*. These are stored securely in the backend and will only be accessible by the admin team.

---

## 3. Managing Clients & Deals

### Clients
Located under the **Clients** tab, you can store your buyer pool.
* You can manually add a client or they auto-populate when someone submits an inquiry on the website.
* **Activity Log:** Each client profile contains a timeline of their actions (e.g., "Inquired about Prime World Unit").

### Deals
A "Deal" binds a Client to a Property. 
1. Navigate to the **Deals** page.
2. Click **+ Create Deal**. 
3. Select the Client and the Property they are buying.
4. Move the deal through the pipeline stages: `Lead/Prospect` ➔ `Reserved` ➔ `Financing Processing` ➔ `Closed/Turnover`.

> [!NOTE]
> Keeping deals updated accurately reflects your pipeline revenue on the Dashboard.

---

## 4. Handling Inquiries

When a prospective buyer browses the public website and fills out a contact form, it lands here.
* Go to **Leads & Inquiries**.
* Click on an inquiry to view the buyer's message and the exact property they are interested in.
* **Status Updates:** Mark them as *New*, *Contacted*, or *Closed*. 

---

## 5. Archives & Soft Deletes

Accidentally deleted a property or a client? 
* **Safe Deletion:** Whenever you delete an item, it doesn't vanish completely. It performs a "soft delete". 
* Go to the **Archives** tab in your sidebar. From here, you can review deleted items and choose to intentionally **Restore** them back to the active list.

> [!CAUTION]
> If you delete an item from the Archives menu, it will be **permanently wiped** from the database and cannot be recovered.
