# Crewvia WhatsApp Bridge (Chrome Extension)

**1-Click Direct WhatsApp Automation for Crewvia Hub without backend server or paid API bills.**

---

## ⚡ Features
- **Zero API Keys & Zero Bills**: Works directly through your logged-in WhatsApp Web tab.
- **1-Click Dispatch**: Trigger message delivery directly from Crewvia CRM without copying/pasting.
- **Anti-Ban Protection**: Built-in 4s–7s randomized jitter delay prevents rate-limiting and bot detection.
- **Automatic Activity Logging**: Seamlessly logs dispatched messages to Supabase `activities` and updates `last_contacted_at`.
- **Intelligent Error Handling**: Detects unregistered/invalid phone numbers and updates CRM status instantly.

---

## 🚀 Quick Setup (Takes 60 Seconds)

1. **Open Chrome Extensions**:
   - In Google Chrome, go to `chrome://extensions/`
2. **Enable Developer Mode**:
   - Toggle the **Developer mode** switch at the top-right corner.
3. **Load Unpacked Extension**:
   - Click the **"Load unpacked"** button at the top-left.
   - Select this folder:
     `d:\crewvia-works\crewvia-hub\extensions\crewvia-whatsapp-bridge`
4. **Login to WhatsApp Web**:
   - Open a tab at [https://web.whatsapp.com](https://web.whatsapp.com) and ensure your phone is connected.
5. **Open Crewvia Hub**:
   - Works on the live project: [https://bni.crewvia.in](https://bni.crewvia.in) as well as local development (`localhost:8080`).
6. **Done!**:
   - Return to Crewvia Hub CRM. All WhatsApp buttons will now show an active green **"⚡ 1-Click WhatsApp"** badge!

---

## 🛡️ Best Practices & Anti-Ban Safety
- Keep WhatsApp Web open in a tab or pinned.
- For bulk outreach, the extension automatically queues requests sequentially with safety pauses.
- Recommended limit: keep initial daily outreach under 80–100 new contacts per day on fresh numbers.
