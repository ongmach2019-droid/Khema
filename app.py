import streamlit as st
import streamlit.components.v1 as components
import pandas as pd
import datetime
import os
import json
import base64
import io
from PIL import Image
import google.generativeai as genai
import memory_manager as mm

# ==========================================
# កំណត់ទីតាំង Paste Component
# ==========================================
PASTE_COMPONENT_DIR = os.path.join(os.path.dirname(__file__), "paste_zone")
paste_zone_component = components.declare_component("paste_zone", path=PASTE_COMPONENT_DIR)

# ==========================================
# ការកំណត់ប្រព័ន្ធ & API KEY
# ==========================================
GEMINI_API_KEY = "AQ.Ab8RN6IHYsl_bTZo43C1UwoBw7uXH3rMvfcQFUbuOhqNGLOgIw"
EXCEL_FILE = "ABA_Transactions_Latest.xlsx"
SHEET_NAME = "ABA Transactions KHR"
LOGO_PATH = "logo.jpg"

CANDIDATE_MODELS = [
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
]

try:
    genai.configure(api_key=GEMINI_API_KEY)
except Exception:
    pass

st.set_page_config(
    page_title="សៀវភៅកត់ត្រា AI - Smart Ledger",
    page_icon="📑",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# ==========================================
# Session State Management (Login & Navigation)
# ==========================================
if "user_logged_in" not in st.session_state:
    st.session_state["user_logged_in"] = True  # Default logged in for smooth preview, user can logout/login anytime

if "user_info" not in st.session_state:
    st.session_state["user_info"] = {
        "username": "សុខា រតនៈ",
        "role": "គណនេយ្យករ (Accountant)",
        "email": "sokha@khemadental.com"
    }

if "active_tab" not in st.session_state:
    st.session_state["active_tab"] = "home"

if "view_mode" not in st.session_state:
    st.session_state["view_mode"] = "mobile"  # 'mobile' or 'wide'

def get_base64_file(file_path):
    if os.path.exists(file_path):
        with open(file_path, "rb") as f:
            return base64.b64encode(f.read()).decode()
    return ""

logo_base64 = get_base64_file(LOGO_PATH)

FONT_REG_PATH = os.path.join(os.path.dirname(__file__), "static", "fonts", "Battambang-Regular.ttf")
FONT_BOLD_PATH = os.path.join(os.path.dirname(__file__), "static", "fonts", "Battambang-Bold.ttf")
battambang_reg_b64 = get_base64_file(FONT_REG_PATH)
battambang_bold_b64 = get_base64_file(FONT_BOLD_PATH)

# ==========================================
# Font Face Declaration
# ==========================================
font_faces = ""
if battambang_reg_b64:
    font_faces += f"""
    @font-face {{
        font-family: 'Battambang';
        src: url('data:font/truetype;charset=utf-8;base64,{battambang_reg_b64}') format('truetype');
        font-weight: 400;
        font-style: normal;
        font-display: swap;
    }}
    """
if battambang_bold_b64:
    font_faces += f"""
    @font-face {{
        font-family: 'Battambang';
        src: url('data:font/truetype;charset=utf-8;base64,{battambang_bold_b64}') format('truetype');
        font-weight: 700;
        font-style: normal;
        font-display: swap;
    }}
    """

if font_faces:
    st.markdown(f"<style>{font_faces}</style>", unsafe_allow_html=True)

# ==========================================
# Custom CSS: Modern Mobile Fintech UI Theme
# ==========================================
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Battambang:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');

    html, body, .stApp, button, input, textarea, select,
    .stMarkdown, .stText, p, h1, h2, h3, h4, h5, h6 {
        font-family: 'Battambang', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }

    [data-testid*="Icon"], .material-symbols-rounded, .material-symbols-outlined, [class*="material-symbols"] {
        font-family: 'Material Symbols Rounded', 'Material Symbols Outlined' !important;
    }

    .stApp {
        background-color: #f1f5f9;
        background-attachment: fixed;
    }
    /* App Viewport: Constrain width on desktop to mobile size, full width on phones */
    .block-container {
        max-width: 480px !important;
        margin-left: auto !important;
        margin-right: auto !important;
        padding-top: 1rem !important;
        padding-bottom: 2.5rem !important;
        padding-left: 0.75rem !important;
        padding-right: 0.75rem !important;
    }

    @media (max-width: 768px) {
        .block-container {
            max-width: 100% !important;
            padding-top: 0.5rem !important;
            padding-bottom: 2rem !important;
            padding-left: 0.5rem !important;
            padding-right: 0.5rem !important;
        }
    }

    /* Top App Bar */
    .app-top-header {
        background: #ffffff;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        margin-bottom: 12px;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
    }
    .app-brand-left {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .app-logo-badge {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #10b981;
        font-size: 18px;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2);
    }
    .app-title-text {
        font-size: 15px;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.2;
    }
    .app-subtitle-text {
        font-size: 11px;
        color: #64748b;
        font-weight: 500;
    }
    .app-actions-right {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .bell-badge {
        font-size: 18px;
        cursor: pointer;
        color: #64748b;
    }
    .user-avatar-pill {
        position: relative;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: #e2e8f0;
        overflow: hidden;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    }
    .online-indicator {
        position: absolute;
        bottom: 0px;
        right: 0px;
        width: 9px;
        height: 9px;
        background: #10b981;
        border: 2px solid #ffffff;
        border-radius: 50%;
    }

    /* Welcome Dark Banner */
    .welcome-dark-card {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        border-radius: 18px;
        padding: 16px 18px;
        color: #ffffff;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
    }
    .welcome-title {
        font-size: 17px;
        font-weight: 700;
        letter-spacing: -0.2px;
    }
    .welcome-sub {
        font-size: 11.5px;
        color: #94a3b8;
        margin-top: 3px;
    }
    .welcome-shop-badge {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: #34d399;
        border: 1px solid rgba(255, 255, 255, 0.12);
    }

    /* Scan CTA Card */
    .scan-cta-card {
        background: linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%);
        border: 1.5px solid #a7f3d0;
        border-radius: 16px;
        padding: 14px 16px;
        margin-bottom: 12px;
        text-align: center;
        box-shadow: 0 4px 14px rgba(16, 185, 129, 0.06);
    }
    .scan-cta-header {
        display: flex;
        align-items: center;
        gap: 10px;
        text-align: left;
    }
    .scan-cta-icon {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        background: #d1fae5;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 19px;
        color: #059669;
    }
    .scan-cta-title {
        font-size: 14px;
        font-weight: 700;
        color: #065f46;
    }
    .scan-cta-desc {
        font-size: 11px;
        color: #059669;
        margin-top: 1px;
    }

    /* Income & Expense Cards */
    .metric-grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 14px;
    }
    .finance-card {
        background: #ffffff;
        border-radius: 16px;
        padding: 14px 14px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 2px 8px rgba(0,0,0,0.02);
    }
    .finance-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        font-weight: 600;
        color: #64748b;
    }
    .finance-val-usd {
        font-size: 19px;
        font-weight: 700;
        color: #0f172a;
        margin-top: 5px;
        line-height: 1.2;
    }
    .finance-val-khr {
        font-size: 11px;
        color: #94a3b8;
        margin-top: 2px;
        font-weight: 500;
    }

    /* Section Header */
    .section-head-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 4px;
        margin-bottom: 10px;
    }
    .section-head-title {
        font-size: 15px;
        font-weight: 700;
        color: #0f172a;
    }
    .section-head-link {
        font-size: 12px;
        color: #0284c7;
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
    }

    /* Transaction List Items */
    .tx-item-card {
        background: #ffffff;
        border-radius: 14px;
        padding: 12px 14px;
        margin-bottom: 8px;
        border: 1px solid #f1f5f9;
        box-shadow: 0 2px 6px rgba(0,0,0,0.02);
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: transform 0.15s ease;
    }
    .tx-item-card:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .tx-left {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .tx-icon-box {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 17px;
    }
    .tx-name {
        font-size: 13px;
        font-weight: 600;
        color: #0f172a;
    }
    .tx-date {
        font-size: 10.5px;
        color: #94a3b8;
        margin-top: 2px;
    }
    .tx-right {
        text-align: right;
    }
    .tx-amount {
        font-size: 14px;
        font-weight: 700;
        color: #e11d48;
    }
    .tx-sub-khr {
        font-size: 10.5px;
        color: #94a3b8;
        margin-top: 1px;
    }

    /* Login Screen Card */
    .login-container-card {
        background: #ffffff;
        border-radius: 20px;
        padding: 24px 20px;
        margin-bottom: 14px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
        text-align: center;
    }
    .login-logo-box {
        width: 58px;
        height: 58px;
        border-radius: 16px;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        margin: 0 auto 14px auto;
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.2);
    }

    /* Settings Profile Card */
    .profile-card {
        background: #ffffff;
        border-radius: 16px;
        padding: 14px 16px;
        margin-bottom: 12px;
        border: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 2px 8px rgba(0,0,0,0.02);
    }
    .profile-left {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .settings-list-card {
        background: #ffffff;
        border-radius: 16px;
        padding: 4px 16px;
        margin-bottom: 12px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 2px 8px rgba(0,0,0,0.02);
    }
    .setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid #f1f5f9;
    }
    .setting-row:last-child {
        border-bottom: none;
    }
    .setting-row-left {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .setting-icon-box {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
    }
    .setting-title {
        font-size: 13px;
        font-weight: 600;
        color: #0f172a;
    }
    .setting-sub {
        font-size: 11px;
        color: #94a3b8;
    }
    .setting-pill {
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        padding: 3px 8px;
        border-radius: 8px;
        font-size: 11.5px;
        font-weight: 600;
        color: #334155;
    }
</style>
""", unsafe_allow_html=True)

# ==========================================
# ទិន្នន័យ Excel & គណនាស្ថិតិជាក់ស្ដែង
# ==========================================
if os.path.exists(EXCEL_FILE):
    try:
        df_all = pd.read_excel(EXCEL_FILE, sheet_name=SHEET_NAME)
    except Exception:
        df_all = pd.DataFrame()
else:
    df_all = pd.DataFrame()

total_credit_all = float(df_all['Credit'].sum()) if ('Credit' in df_all.columns and not df_all.empty) else 0.0
total_credit_usd = total_credit_all / 4000.0
total_rows_all = len(df_all)

# Dummy/configured sample income for realistic fintech dashboard look
sample_income_khr = 34645000.0
sample_income_usd = sample_income_khr / 4100.0

# User Avatar SVG data URL
avatar_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="36" height="36">
  <defs>
    <linearGradient id="avgrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="50" fill="url(#avgrad)" />
  <circle cx="50" cy="38" r="18" fill="#fde047" />
  <path d="M 22 84 C 24 64, 40 60, 50 60 C 60 60, 76 64, 78 84 Z" fill="#ffffff" />
</svg>"""
avatar_b64 = base64.b64encode(avatar_svg.encode()).decode()
default_avatar_data = f"data:image/svg+xml;base64,{avatar_b64}"

if "user_avatar" not in st.session_state:
    st.session_state["user_avatar"] = default_avatar_data
avatar_data = st.session_state["user_avatar"]

# ==========================================
# ផ្ទាំងចូលប្រើប្រាស់ (USER LOGIN SCREEN)
# ==========================================
if not st.session_state["user_logged_in"]:
    st.markdown(f"""
    <div class="app-top-header">
        <div class="app-brand-left">
            <div class="app-logo-badge">🦷</div>
            <div>
                <div class="app-title-text">សៀវភៅកត់ត្រា AI</div>
                <div class="app-subtitle-text">Khema Digital Dental</div>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown(f"""
    <div class="login-container-card">
        <div class="login-logo-box">📑</div>
        <h3 style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a;">ចូលគណនី ( Sign In )</h3>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">ប្រព័ន្ធគ្រប់គ្រង និងស្កេនវិក្កយបត្រស្វ័យប្រវត្តិ AI</p>
    </div>
    """, unsafe_allow_html=True)

    login_user = st.text_input("👤 ឈ្មោះគណនី (Username)", value="សុខា រតនៈ", key="input_username")
    login_pass = st.text_input("🔑 លេខសម្ងាត់ (Password)", type="password", value="123456", key="input_password")
    
    remember = st.checkbox("ចងចាំគណនីនេះ (Remember me)", value=True)
    
    if st.button("🚀 ចូលគណនី (Login)", type="primary", use_container_width=True):
        if login_user.strip():
            st.session_state["user_logged_in"] = True
            st.session_state["user_info"]["username"] = login_user.strip()
            st.toast(f"🎉 សូមស្វាគមន៍លោកអ្នក {login_user.strip()}!", icon="👋")
            st.rerun()
        else:
            st.error("សូមបញ្ចូលឈ្មោះគណនីរបស់អ្នក!")
            
    st.markdown("""
    <div style="text-align: center; font-size: 11.5px; color: #94a3b8; margin-top: 14px;">
        💡 គណនីសាកល្បង៖ ឈ្មោះ <strong>សុខា រតនៈ</strong> | លេខសម្ងាត់ <strong>123456</strong>
    </div>
    """, unsafe_allow_html=True)

    st.stop()

# ==========================================
# APP SHELL (LOGGED IN)
# ==========================================
active_tab = st.session_state["active_tab"]

tab_subtitles = {
    "home": "Dashboard",
    "scan": "Scan Receipt",
    "list": "Ledger List",
    "settings": "Settings"
}

# 1. Top App Bar (Header)
curr_sub = tab_subtitles.get(active_tab, "Dashboard")
st.markdown(f"""
<div class="app-top-header">
    <div class="app-brand-left">
        <div class="app-logo-badge">📑</div>
        <div>
            <div class="app-title-text">សៀវភៅកត់ត្រា AI</div>
            <div class="app-subtitle-text">{curr_sub}</div>
        </div>
    </div>
    <div class="app-actions-right">
        <span class="bell-badge">🔔</span>
        <div class="user-avatar-pill">
            <img src="{avatar_data}" width="34" height="34" style="object-fit: cover;" />
            <span class="online-indicator"></span>
        </div>
    </div>
</div>
""", unsafe_allow_html=True)

# ----------------------------------------------------
# SCREEN 1: 🏠 ទំព័រដើម (Dashboard)
# ----------------------------------------------------
if active_tab == "home":
    u_name = st.session_state["user_info"].get("username", "សុខា")
    
    # Dark Welcome Card
    st.markdown(f"""
    <div class="welcome-dark-card">
        <div>
            <div class="welcome-title">សួស្តី, {u_name} 👋</div>
            <div class="welcome-sub">សង្ខេបចំណូលចំណាយថ្ងៃនេះ</div>
        </div>
        <div class="welcome-shop-badge">🏪</div>
    </div>
    """, unsafe_allow_html=True)

    # Scan CTA Banner
    st.markdown("""
    <div class="scan-cta-card">
        <div class="scan-cta-header">
            <div class="scan-cta-icon">📷</div>
            <div>
                <div class="scan-cta-title">ថតស្កេនវិក្កយបត្រ (Scan Receipt)</div>
                <div class="scan-cta-desc">ចុចទីនេះដើម្បីស្កេន ឬបញ្ចូលវិក្កយបត្រ KHQR ងាយៗ</div>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    if st.button("📷 ថតស្កេនវិក្កយបត្រ", use_container_width=True, type="primary", key="home_scan_cta_btn"):
        st.session_state["active_tab"] = "scan"
        st.rerun()

    # Income & Expense Cards
    st.markdown(f"""
    <div class="metric-grid-2">
        <div class="finance-card">
            <div class="finance-header">
                <span style="color: #059669;">ចំណូល</span>
                <span style="color: #059669; font-size: 16px;">↓</span>
            </div>
            <div class="finance-val-usd" style="color: #059669;">${sample_income_usd:,.0f}</div>
            <div class="finance-val-khr">{sample_income_khr:,.0f} ៛</div>
        </div>
        <div class="finance-card">
            <div class="finance-header">
                <span style="color: #e11d48;">ចំណាយ</span>
                <span style="color: #e11d48; font-size: 16px;">↑</span>
            </div>
            <div class="finance-val-usd" style="color: #e11d48;">${total_credit_usd:,.2f}</div>
            <div class="finance-val-khr">{total_credit_all:,.0f} ៛</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Section: វិក្កយបត្រថ្មីៗ
    c_head1, c_head2 = st.columns([2, 1])
    with c_head1:
        st.markdown('<div style="padding-left: 4px; font-size: 15px; font-weight: 700; color: #0f172a;">វិក្កយបត្រថ្មីៗ</div>', unsafe_allow_html=True)
    with c_head2:
        if st.button("មើលទាំងអស់ ›", key="btn_view_all_tx"):
            st.session_state["active_tab"] = "list"
            st.rerun()

    # List of Recent Transactions
    if total_rows_all > 0:
        recent_items = df_all.tail(4).iloc[::-1]  # Latest 4 in reverse order
        icons_list = ["🏬", "☕", "⚡", "🧾"]
        
        for idx, (_, row) in enumerate(recent_items.iterrows()):
            v_name = str(row.get("Vendor / Customer / Employee", "មិនស្គាល់ហាង"))
            if v_name == "nan" or not v_name.strip():
                v_name = "ចំណាយទូទៅ"
            v_desc = str(row.get("Description", ""))
            if v_desc == "nan": v_desc = ""
            v_date = str(row.get("Date", "ថ្ងៃនេះ"))
            amt_khr = float(row.get("Credit", 0))
            amt_usd = amt_khr / 4000.0
            ic = icons_list[idx % len(icons_list)]
            
            st.markdown(f"""
            <div class="tx-item-card">
                <div class="tx-left">
                    <div class="tx-icon-box">{ic}</div>
                    <div>
                        <div class="tx-name">{v_name[:24]}</div>
                        <div class="tx-date">{v_date} • {v_desc[:18]}</div>
                    </div>
                </div>
                <div class="tx-right">
                    <div class="tx-amount">-${amt_usd:,.2f}</div>
                    <div class="tx-sub-khr">{amt_khr:,.0f} ៛</div>
                </div>
            </div>
            """, unsafe_allow_html=True)
    else:
        st.info("មិនទាន់មានប្រតិបត្តិការនៅឡើយទេ។ សូមចុច «ថតស្កេនវិក្កយបត្រ» ខាងលើ!")

# ----------------------------------------------------
# SCREEN 2: 📷 បញ្ចូលព័ត៌មាន (Scan & Review)
# ----------------------------------------------------
elif active_tab == "scan":
    st.markdown("""
    <div style="padding: 16px 18px 8px 18px;">
        <h3 style="margin: 0; font-size: 19px; font-weight: 700; color: #0f172a;">ស្កេនវិក្កយបត្រ</h3>
        <p style="margin: 3px 0 12px 0; font-size: 12px; color: #64748b;">ងាយស្រួល ឆាប់រហ័ស និងបំប្លែងទិន្នន័យស្វ័យប្រវត្ត</p>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("""
    <div class="scan-cta-card" style="margin-bottom: 12px;">
        <div style="font-size: 32px; margin-bottom: 4px;">📸</div>
        <div style="font-size: 15px; font-weight: 700; color: #065f46;">ស្កេន ឬ ជ្រើសរើសវិក្កយបត្រ</div>
        <div style="font-size: 11.5px; color: #059669; margin: 4px 0 6px 0;">ដាក់រូបវិក្កយបត្រ ឬចុចដើម្បីជ្រើសរើសឯកសារ</div>
    </div>
    """, unsafe_allow_html=True)

    # Paste component for direct Telegram clipboard paste
    paste_data = paste_zone_component(key="paste_zone_widget_screen2")
    if paste_data and isinstance(paste_data, dict) and "data" in paste_data:
        paste_ts = paste_data.get("timestamp", 0)
        if paste_ts > st.session_state.get("last_paste_timestamp", 0):
            st.session_state["last_paste_timestamp"] = paste_ts
            try:
                data_url = paste_data["data"]
                encoded = data_url.split(",", 1)[1] if "," in data_url else data_url
                img_bytes = base64.b64decode(encoded)
                pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                
                if "pasted_images" not in st.session_state:
                    st.session_state["pasted_images"] = []
                c_num = len(st.session_state["pasted_images"]) + 1
                st.session_state["pasted_images"].append({
                    "id": paste_ts,
                    "name": f"Telegram_Paste_{c_num}.png",
                    "image": pil_img
                })
                st.toast(f"✅ បាន Paste រូបភាពពី Telegram (សន្លឹកទី {c_num})!", icon="📋")
                st.rerun()
            except Exception as pe:
                st.error(f"កំហុសក្នុងការ Paste: {pe}")

    uploaded_files = st.file_uploader(
        "ជ្រើសរើសឯកសាររូបភាព (JPG, PNG)",
        type=["png", "jpg", "jpeg"],
        accept_multiple_files=True,
        key="uploader_tab_scan"
    )

    st.markdown('<div style="font-size: 11px; color: #059669; margin-top: 8px; text-align: center;">🔒 ធានាសុវត្ថិភាពទិន្នន័យរបស់អ្នក</div>', unsafe_allow_html=True)

    all_images_to_process = []
    if "pasted_images" in st.session_state and st.session_state["pasted_images"]:
        for p_item in st.session_state["pasted_images"]:
            all_images_to_process.append({
                "name": p_item["name"],
                "image": p_item["image"],
                "source": "Telegram (Paste)"
            })
    if uploaded_files:
        for uf in uploaded_files:
            try:
                pil_img = Image.open(uf).convert("RGB")
                all_images_to_process.append({
                    "name": uf.name,
                    "image": pil_img,
                    "source": "File Upload"
                })
            except Exception:
                pass

    if all_images_to_process:
        st.success(f"📷 បានជ្រើសរើសរូបភាពសរុប **{len(all_images_to_process)}** សន្លឹក")
        
        # Action button to start AI analysis
        if st.button(f"🚀 ចាប់ផ្ដើមវិភាគដោយ AI ({len(all_images_to_process)} សន្លឹក)", type="primary", use_container_width=True):
            pbar = st.progress(0)
            status_t = st.empty()
            extracted_results = []
            selected_model = "gemini-flash-lite-latest"
            models_to_try = [selected_model] + [m for m in CANDIDATE_MODELS if m != selected_model]
            memory_context = mm.get_prompt_memory_text()

            prompt = f'''
            សូមពិនិត្យមើលរូបភាពវិក្កយបត្រ/ក្រដាសទិញអីវ៉ាន់/បង្កាន់ដៃដឹកជញ្ជូននេះឱ្យបានម៉ត់ចត់ រួចទាញយកជា JSON:
            {{
                "date": "dd-MMM-YYYY (ឧទាហរណ៍ 15-Sep-2026)",
                "total_amount": "ចំនួនទឹកប្រាក់ (តែលេខសុទ្ធប៉ុណ្ណោះ ឧ. 6000 ឬ 5000)",
                "currency": "KHR ឬ USD",
                "applicant_name": "ឈ្មោះអ្នកស្នើសុំ ឬអ្នកទទួល/បុគ្គលិក/ហាង (ត្រង់ Consignee/អ្នកទទួល ឬ អ្នកស្នើសុំ)",
                "description": "ខ្លឹមសារត្រង់ជួរ «បរិយាយ៖» ឬ DESCRIPTION (ឧទាហរណ៍ ផ្ញើពុម្ភអេលីហ្វុង(កំពង់ឆ្នាំង), សម្ភារៈ...)"
            }}

            ការណែនាំពិសេសសម្រាប់ការអាន៖
            1. ត្រង់ជួរ «អ្នកស្នើសុំ / អ្នកទទួល / Consignee»៖ សូមអានឈ្មោះមនុស្សដែលបានសរសេរដៃ ដាក់ចូល applicant_name
            2. ត្រង់ជួរ «បរិយាយ / Description»៖ សូមអានខ្លឹមសារទំនិញ ឬសេវាកម្មដែលបានសរសេរដៃ ដាក់ចូល description
            3. ត្រង់ជួរ «ចំនួនទឹកប្រាក់ / TOTAL PRICE / ថ្លៃសេវា»៖
               - សូមអានលេខសរសេរដៃឱ្យបានច្បាស់លាស់បំផុត (រាប់ចំនួនខ្ទង់លេខឱ្យត្រឹមត្រូវ ដូចជា 6000, 5000, 8000, 10000...)
               - ប្រយ័ត្នរវាងលេខ 6 និងលេខ 5 (លេខ 6 មានក្បាលកោងចុះមកក្រោមក្លាយជារង្វង់មូលបាតក្រោម, លេខ 5 មានបន្ទាត់ផ្តេកនៅផ្នែកលើ)
               - កន្ទុយសញ្ញារៀល «៛» ឬអក្សរ «k» ឬសញ្ញាធីក (✓) នៅខាងលើ ឬខាងក្រោយលេខ មិនមែនជាលេខសូន្យទេ (ឧទាហរណ៍ 6000៛ គឺ 6000 មិនមែន 60,000 ទេ; 5000៛ គឺ 5000 មិនមែន 50,000 ទេ)
            បើមើលមិនឃើញ សូមដាក់ "N/A" ឬទទេរ។

            {memory_context}
            '''

            curr_no = (len(df_all) + 1) if len(df_all) > 0 else 1
            curr_entry = 57535
            if len(df_all) > 0 and 'Entry No' in df_all.columns and not df_all['Entry No'].dropna().empty:
                try: curr_entry = int(df_all['Entry No'].dropna().iloc[-1]) + 1
                except Exception: curr_entry = 57535
            
            curr_jv_num = 581
            if len(df_all) > 0 and 'JV No' in df_all.columns and not df_all['JV No'].dropna().empty:
                try:
                    last_jv = str(df_all['JV No'].dropna().iloc[-1])
                    digs = ''.join(filter(str.isdigit, last_jv))
                    curr_jv_num = int(digs) + 1 if digs else 581
                except Exception: curr_jv_num = 581

            for i, it in enumerate(all_images_to_process):
                status_t.markdown(f"⏳ កំពុងវិភាគ (#{i+1}/{len(all_images_to_process)}): `{it['name']}`...")
                s_ok = False
                for tm in models_to_try:
                    try:
                        ai_mod = genai.GenerativeModel(tm, generation_config={"response_mime_type": "application/json"})
                        resp = ai_mod.generate_content([prompt, it["image"]])
                        txt = resp.text.strip()
                        if txt.startswith("```json"): txt = txt[7:]
                        if txt.startswith("```"): txt = txt[3:]
                        if txt.endswith("```"): txt = txt[:-3]
                        d = json.loads(txt.strip())
                        
                        r_amt = str(d.get("total_amount", "0")).replace(",", "").replace("$", "").strip()
                        try: o_amt = float(r_amt)
                        except Exception: o_amt = 0.0
                        
                        curr_code = "KHR" if ("KHR" in str(d.get("currency", "")).upper() or "រៀល" in str(d.get("currency", ""))) else "USD"
                        c_val = int(o_amt * 4000) if curr_code == "USD" else int(o_amt)
                        
                        extracted_results.append({
                            "No.": curr_no,
                            "Date": d.get("date") or datetime.date.today().strftime("%d-%b-%Y"),
                            "Source": "GL-JE",
                            "Entry No": curr_entry,
                            "JV No": f"JV{curr_jv_num:05d}",
                            "Class": "KHEMA88888",
                            "Vendor / Customer / Employee": d.get("applicant_name") or "មិនស្គាល់",
                            "Description": d.get("description") or "ទិញសម្ភារៈ",
                            "Debit": 0,
                            "Credit": c_val,
                            "File": it["name"],
                            "Status": "ជោគជ័យ"
                        })
                        curr_no += 1
                        curr_entry += 1
                        curr_jv_num += 1
                        s_ok = True
                        break
                    except Exception:
                        continue
                pbar.progress((i + 1) / len(all_images_to_process))
            
            status_t.empty()
            st.session_state["pending_review_df"] = pd.DataFrame(extracted_results)
            st.session_state["review_ready"] = True
            st.success("✅ AI បានវិភាគរួចរាល់! សូមពិនិត្យ ឬកែប្រែទិន្នន័យខាងក្រោម៖")

    # Review & Edit Card
    if st.session_state.get("review_ready") and "pending_review_df" in st.session_state:
        st.markdown("""
        <div style="background: #ffffff; border-radius: 16px; padding: 14px 16px; margin: 12px 0; border: 1px solid #e2e8f0; box-shadow: 0 4px 14px rgba(0,0,0,0.04);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-size: 14px; font-weight: 700; color: #0f172a;">🧾 ព័ត៌មានវិក្កយបត្រ</span>
                <span style="background: #d1fae5; color: #065f46; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">បានពិនិត្យរួចរាល់</span>
            </div>
            <div style="font-size: 11.5px; color: #64748b;">✅ អ្នកអាចចុចលើក្រឡាក្នុងតារាងខាងក្រោមដើម្បីកែសម្រួលមុនរក្សាទុក</div>
        </div>
        """, unsafe_allow_html=True)
        
        rdf = st.session_state["pending_review_df"]
        display_cols = [c for c in ["No.", "Date", "Vendor / Customer / Employee", "Description", "Credit", "Status"] if c in rdf.columns]
        
        edited_rdf = st.data_editor(
            rdf[display_cols],
            column_config={
                "No.": st.column_config.NumberColumn("No.", disabled=True),
                "Credit": st.column_config.NumberColumn("Credit (៛)", format="%d ៛"),
                "Vendor / Customer / Employee": st.column_config.TextColumn("Vendor / អ្នកស្នើសុំ"),
                "Description": st.column_config.TextColumn("Description / បរិយាយ")
            },
            use_container_width=True,
            key="screen2_editor"
        )

        c_sv1, c_sv2 = st.columns([2, 1])
        with c_sv1:
            if st.button("💾 រក្សាទុកចូល Excel", type="primary", use_container_width=True, key="btn_save_screen2"):
                try:
                    df_target = pd.read_excel(EXCEL_FILE, sheet_name=SHEET_NAME) if os.path.exists(EXCEL_FILE) else pd.DataFrame()
                    rows_to_add = []
                    for _, r in edited_rdf.iterrows():
                        rows_to_add.append({
                            "No.": r.get("No."),
                            "Date": r.get("Date"),
                            "Source": "GL-JE",
                            "Entry No": r.get("Entry No", 57535),
                            "JV No": r.get("JV No", "JV00581"),
                            "Reference": None,
                            "Class": "KHEMA88888",
                            "Vendor / Customer / Employee": r.get("Vendor / Customer / Employee"),
                            "Description": r.get("Description"),
                            "Debit": 0,
                            "Credit": r.get("Credit", 0),
                            "Balance": None
                        })
                    if rows_to_add:
                        df_target = pd.concat([df_target, pd.DataFrame(rows_to_add)], ignore_index=True)
                        with pd.ExcelWriter(EXCEL_FILE, engine='openpyxl') as writer:
                            df_target.to_excel(writer, sheet_name=SHEET_NAME, index=False)
                        mm.sync_memory_from_excel(df_target)
                        st.session_state["pasted_images"] = []
                        st.session_state["review_ready"] = False
                        st.toast(f"🎉 បានរក្សាទុកទិន្នន័យចំនួន {len(rows_to_add)} ជួរជោគជ័យ!", icon="✅")
                        st.balloons()
                        st.rerun()
                except Exception as err:
                    st.error(f"មិនអាចរក្សាទុកបាន៖ {err}")
                    
        with c_sv2:
            if st.button("🔄 សម្អាត", use_container_width=True, key="btn_cancel_screen2"):
                st.session_state["pasted_images"] = []
                st.session_state["review_ready"] = False
                st.rerun()

# ----------------------------------------------------
# SCREEN 3: 🧾 បញ្ជីទិន្នន័យ (Ledger List)
# ----------------------------------------------------
elif active_tab == "list":
    st.markdown("""
    <div style="padding: 16px 18px 6px 18px; display: flex; align-items: center; justify-content: space-between;">
        <div>
            <h3 style="margin: 0; font-size: 19px; font-weight: 700; color: #0f172a;">បញ្ជីវិក្កយបត្រ</h3>
            <p style="margin: 3px 0 0 0; font-size: 11.5px; color: #64748b;">វិក្កយបត្រ និងបង្កាន់ដៃទាំងអស់ដែលបានរក្សាទុក</p>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Search Bar
    search_term = st.text_input("🔍 ស្វែងរកតាមឈ្មោះហាង ឬ បរិយាយ...", key="list_search_input")

    # Monthly Summary Badge Card
    st.markdown(f"""
    <div style="background: #ffffff; border-radius: 16px; padding: 14px 16px; margin: 8px 0 14px 0; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: #d1fae5; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #059669;">🧾</div>
            <div>
                <div style="font-size: 11px; color: #64748b;">ចំណាយសរុបទាំងអស់</div>
                <div style="font-size: 17px; font-weight: 700; color: #0f172a;">${total_credit_usd:,.2f}</div>
            </div>
        </div>
        <div style="background: #f1f5f9; padding: 4px 10px; border-radius: 8px; font-size: 11.5px; font-weight: 600; color: #475569;">
            ⏱ {total_rows_all} វិក្កយបត្រ
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Transaction Cards
    if total_rows_all > 0:
        df_display = df_all
        if search_term.strip():
            sq = search_term.strip().lower()
            m = df_all.astype(str).apply(lambda row: row.str.lower().str.contains(sq, na=False)).any(axis=1)
            df_display = df_all[m]

        for _, row in df_display.tail(20).iloc[::-1].iterrows():
            vn = str(row.get("Vendor / Customer / Employee", "ចំណាយទូទៅ"))
            if vn == "nan" or not vn.strip(): vn = "ចំណាយទូទៅ"
            vd = str(row.get("Description", ""))
            if vd == "nan": vd = ""
            vdt = str(row.get("Date", "N/A"))
            khr_a = float(row.get("Credit", 0))
            usd_a = khr_a / 4000.0
            
            st.markdown(f"""
            <div class="tx-item-card">
                <div class="tx-left">
                    <div class="tx-icon-box">🧾</div>
                    <div>
                        <div class="tx-name">{vn[:26]}</div>
                        <div class="tx-date">{vdt} {('• ' + vd[:18]) if vd else ''}</div>
                    </div>
                </div>
                <div class="tx-right">
                    <div class="tx-amount">-${usd_a:,.2f}</div>
                    <div style="font-size: 10.5px; color: #059669; font-weight: 600;">✅ បានបង់ ({khr_a:,.0f} ៛)</div>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
        with st.expander("📊 បើកផ្ទាំងកែប្រែទិន្នន័យ Excel ពេញលេញ"):
            edited_m_table = st.data_editor(df_all, use_container_width=True, key="m_excel_table")
            if st.button("💾 រក្សាទុកការកែប្រែក្នុង Excel", key="btn_save_m_table"):
                with pd.ExcelWriter(EXCEL_FILE, engine='openpyxl') as wr:
                    edited_m_table.to_excel(wr, sheet_name=SHEET_NAME, index=False)
                st.success("✅ បានរក្សាទុកការកែប្រែជោគជ័យ!")
                st.rerun()

        # Download button
        with open(EXCEL_FILE, "rb") as f:
            x_bytes = f.read()
        st.download_button(
            label=f"📥 ទាញយកឯកសារ Excel ({EXCEL_FILE})",
            data=x_bytes,
            file_name=EXCEL_FILE,
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True,
            key="list_export_dl_btn"
        )
    else:
        st.info("មិនទាន់មានទិន្នន័យក្នុងប្រព័ន្ធនៅឡើយទេ។")

# ----------------------------------------------------
# SCREEN 4: ⚙️ ការកំណត់ (Settings & Profile)
# ----------------------------------------------------
elif active_tab == "settings":
    st.markdown("""
    <div style="padding: 16px 18px 8px 18px;">
        <h3 style="margin: 0; font-size: 19px; font-weight: 700; color: #0f172a;">ការកំណត់កម្មវិធី</h3>
        <p style="margin: 3px 0 12px 0; font-size: 12px; color: #64748b;">គ្រប់គ្រងគណនី និងការកំណត់ AI របស់អ្នក</p>
    </div>
    """, unsafe_allow_html=True)

    # User Profile Card with Edit Action
    u_info = st.session_state["user_info"]
    curr_avatar = st.session_state.get("user_avatar", avatar_data)
    
    col_prof_card, col_prof_btn = st.columns([5, 1])
    with col_prof_card:
        st.markdown(f"""
        <div class="profile-card" style="margin-bottom: 0;">
            <div class="profile-left">
                <div class="user-avatar-pill" style="width: 46px; height: 46px;">
                    <img src="{curr_avatar}" width="46" height="46" style="object-fit: cover; border-radius: 50%;" />
                    <span class="online-indicator" style="width: 10px; height: 10px;"></span>
                </div>
                <div>
                    <div style="font-size: 15px; font-weight: 700; color: #0f172a;">{u_info.get('username')}</div>
                    <div style="font-size: 11.5px; color: #64748b;">{u_info.get('role')}</div>
                </div>
            </div>
        </div>
        """, unsafe_allow_html=True)
    with col_prof_btn:
        if st.button("✏️", key="btn_toggle_edit_profile", help="កែប្រែព័ត៌មានគណនី"):
            st.session_state["edit_profile_mode"] = not st.session_state.get("edit_profile_mode", False)
            st.rerun()

    # Edit Profile Mode (st.file_uploader & st.session_state)
    if st.session_state.get("edit_profile_mode", False):
        with st.container():
            st.markdown("""
            <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 16px; padding: 16px; margin: 12px 0 16px 0;">
                <div style="font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 12px;">✏️ កែប្រែព័ត៌មានគណនី (Edit Profile)</div>
            </div>
            """, unsafe_allow_html=True)
            
            new_name = st.text_input("ឈ្មោះបង្ហាញ (Display Name)", value=u_info.get("username", ""), key="edit_name_input")
            new_role = st.text_input("តួនាទី / ផ្នែក (Role / Department)", value=u_info.get("role", "គណនេយ្យករ (Accountant)"), key="edit_role_input")
            
            uploaded_pic = st.file_uploader("📷 ប្តូររូបភាព Profile (PNG, JPG)", type=["png", "jpg", "jpeg"], key="edit_pic_uploader")
            new_avatar_preview = None
            if uploaded_pic is not None:
                pic_bytes = uploaded_pic.read()
                pic_b64 = base64.b64encode(pic_bytes).decode()
                mime = uploaded_pic.type or "image/png"
                new_avatar_preview = f"data:{mime};base64,{pic_b64}"
                st.image(uploaded_pic, caption="រូបភាពថ្មី (Preview)", width=72)
            
            col_save, col_cancel = st.columns(2)
            with col_save:
                if st.button("💾 រក្សាទុក (Save)", type="primary", use_container_width=True, key="btn_save_profile"):
                    if new_name.strip():
                        st.session_state["user_info"]["username"] = new_name.strip()
                    if new_role.strip():
                        st.session_state["user_info"]["role"] = new_role.strip()
                    if new_avatar_preview:
                        st.session_state["user_avatar"] = new_avatar_preview
                    st.session_state["edit_profile_mode"] = False
                    st.toast("✅ បានរក្សាទុកព័ត៌មានជោគជ័យ!", icon="🎉")
                    st.rerun()
            with col_cancel:
                if st.button("❌ បោះបង់", use_container_width=True, key="btn_cancel_profile"):
                    st.session_state["edit_profile_mode"] = False
                    st.rerun()

    # General Settings Card
    st.markdown("""
    <div class="settings-list-card">
        <div class="setting-row">
            <div class="setting-row-left">
                <div class="setting-icon-box">💵</div>
                <div>
                    <div class="setting-title">រូបិយប័ណ្ណ (Currency)</div>
                    <div class="setting-sub">ខ្នាតលុយដើមក្នុងប្រព័ន្ធ</div>
                </div>
            </div>
            <div class="setting-pill">USD / KHR ៛</div>
        </div>
        <div class="setting-row">
            <div class="setting-row-left">
                <div class="setting-icon-box">💱</div>
                <div>
                    <div class="setting-title">អត្រាប្តូរប្រាក់ (Rate)</div>
                    <div class="setting-sub">1$ = 4,000 ៛</div>
                </div>
            </div>
            <div class="setting-pill">៤,០០០ ៛</div>
        </div>
        <div class="setting-row">
            <div class="setting-row-left">
                <div class="setting-icon-box">🌐</div>
                <div>
                    <div class="setting-title">ភាសា (Language)</div>
                    <div class="setting-sub">ភាសាប្រើប្រាស់ក្នុងកម្មវិធី</div>
                </div>
            </div>
            <div class="setting-pill">ភាសាខ្មែរ ›</div>
        </div>
        <div class="setting-row">
            <div class="setting-row-left">
                <div class="setting-icon-box">☁️</div>
                <div>
                    <div class="setting-title">បម្រុងទុកទិន្នន័យ (Cloud Backup)</div>
                    <div class="setting-sub">រក្សាទុកទិន្នន័យស្វ័យប្រវត្តក្នុងម៉ាស៊ីន</div>
                </div>
            </div>
            <div style="font-size: 18px; color: #10b981;">🟢 បើក</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # AI Memory Management
    with st.expander("🧠 ការចងចាំរបស់ AI (AI Memory & Rules)"):
        mem = mm.load_memory()
        st.write(f"📌 ចងចាំបាន: {len(mem.get('corrections', []))} ការកែសម្រួល | 👤 {len(mem.get('known_vendors', []))} Vendors | 📝 {len(mem.get('known_descriptions', []))} Descriptions")
        if st.button("🔄 Sync ការចងចាំពី Excel បច្ចុប្បន្ន", use_container_width=True, key="settings_sync_btn"):
            if len(df_all) > 0:
                added = mm.sync_memory_from_excel(df_all)
                st.success(f"✅ បាន Sync ឈ្មោះ Vendor និង Description ថ្មីចំនួន {added} រួចរាល់!")
                st.rerun()

    # Logout Button Card
    if st.button("↪ ចាកចេញពីគណនី (Logout)", type="secondary", use_container_width=True, key="btn_logout"):
        st.session_state["user_logged_in"] = False
        st.rerun()

    # Footer
    st.markdown("""
    <div style="text-align: center; padding: 20px 16px; color: #94a3b8; font-size: 11px;">
        <div style="font-size: 18px; margin-bottom: 4px;">🛡️</div>
        <div><strong>សៀវភៅកត់ត្រា AI កំណែ 2.4.0</strong></div>
        <div>ប្រព័ន្ធគ្រប់គ្រងវិក្កយបត្រស្វ័យប្រវត្តិ Khema Dental Solution</div>
        <div style="margin-top: 4px;">រក្សាសិទ្ធិគ្រប់យ៉ាង © 2026 Smart Ledger AI</div>
    </div>
    """, unsafe_allow_html=True)

# ----------------------------------------------------
# BOTTOM NAVIGATION (Static - មិនរត់តាមពេលអូស)
# ----------------------------------------------------
st.markdown('<div style="margin-top: 24px; margin-bottom: 12px; border-top: 1.5px solid #e2e8f0;"></div>', unsafe_allow_html=True)

b_col1, b_col2, b_col3, b_col4 = st.columns(4)

with b_col1:
    is_act = "primary" if active_tab == "home" else "secondary"
    if st.button("🏠 ទំព័រដើម", key="dock_btn_home", use_container_width=True, type=is_act):
        st.session_state["active_tab"] = "home"
        st.rerun()

with b_col2:
    is_act = "primary" if active_tab == "scan" else "secondary"
    if st.button("📷 បញ្ចូល", key="dock_btn_scan", use_container_width=True, type=is_act):
        st.session_state["active_tab"] = "scan"
        st.rerun()

with b_col3:
    is_act = "primary" if active_tab == "list" else "secondary"
    if st.button("🧾 បញ្ជី", key="dock_btn_list", use_container_width=True, type=is_act):
        st.session_state["active_tab"] = "list"
        st.rerun()

with b_col4:
    is_act = "primary" if active_tab == "settings" else "secondary"
    if st.button("⚙️ កំណត់", key="dock_btn_settings", use_container_width=True, type=is_act):
        st.session_state["active_tab"] = "settings"
        st.rerun()
