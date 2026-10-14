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
# ការកំណត់ប្រព័ន្ធ & API KEY (SYSTEM CONFIGURATION)
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

# ==========================================
# កំណត់រចនាសម្ព័ន្ធទំព័រ (Mobile-Friendly Auto Sidebar)
# ==========================================
st.set_page_config(
    page_title="Khema Digital Dental Clinic - Invoice Automation",
    page_icon="🦷",
    layout="wide",
    initial_sidebar_state="auto"
)

def get_base64_file(file_path):
    if os.path.exists(file_path):
        with open(file_path, "rb") as f:
            return base64.b64encode(f.read()).decode()
    return ""

def get_base64_image(image_path):
    return get_base64_file(image_path)

logo_base64 = get_base64_image(LOGO_PATH)

FONT_REG_PATH = os.path.join(os.path.dirname(__file__), "static", "fonts", "Battambang-Regular.ttf")
FONT_BOLD_PATH = os.path.join(os.path.dirname(__file__), "static", "fonts", "Battambang-Bold.ttf")
battambang_reg_b64 = get_base64_file(FONT_REG_PATH)
battambang_bold_b64 = get_base64_file(FONT_BOLD_PATH)

# ==========================================
# Custom CSS: រចនាបែប Digital Dental Clinic & Mobile Responsive
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

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Battambang:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');

    /* Typography សម្រាប់ Text ទាំងអស់ប្រើ Battambang */
    html, body, .stApp, button, input, textarea, select,
    .stMarkdown, .stText, p, h1, h2, h3, h4, h5, h6,
    .dental-header, .dental-title-group, .metric-card, .clinic-card {
        font-family: 'Battambang', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }

    /* ការពារ Material Icons មិនឱ្យបាត់បង់ */
    [data-testid*="Icon"], .material-symbols-rounded, .material-symbols-outlined, [class*="material-symbols"] {
        font-family: 'Material Symbols Rounded', 'Material Symbols Outlined' !important;
        font-style: normal !important;
        letter-spacing: normal !important;
    }

    /* Background Theme */
    .stApp {
        background-color: #f8fafc;
        background-image: 
            radial-gradient(at 0% 0%, rgba(0, 152, 218, 0.08) 0px, transparent 50%),
            radial-gradient(at 100% 0%, rgba(14, 165, 233, 0.06) 0px, transparent 50%),
            radial-gradient(at 50% 100%, rgba(224, 242, 254, 0.35) 0px, transparent 50%);
        background-attachment: fixed;
    }

    /* Header Container - ស្អាត បង្រួម មិនរញេរញៃ */
    .dental-header {
        background: #ffffff;
        border: 1px solid #e0f2fe;
        border-radius: 16px;
        padding: 14px 20px;
        margin-bottom: 14px;
        box-shadow: 0 4px 16px -2px rgba(0, 152, 218, 0.06);
        display: flex;
        align-items: center;
        gap: 14px;
    }
    .dental-main-title {
        font-size: 21px;
        font-weight: 700;
        color: #0098DA !important;
    }

    /* Navigation Bar (Tabs) - ស្រួលចុចលើទូរសព្ទដៃ */
    .stTabs [data-baseweb="tab-list"] {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 6px !important;
        background: #f1f5f9 !important;
        padding: 6px !important;
        border-radius: 12px !important;
        border-bottom: none !important;
        margin-bottom: 18px !important;
    }
    .stTabs [data-baseweb="tab"] {
        flex: 1 1 auto !important;
        min-width: 130px !important;
        text-align: center !important;
        justify-content: center !important;
        border-radius: 9px !important;
        padding: 9px 14px !important;
        font-weight: 600 !important;
        font-size: 14px !important;
        color: #475569 !important;
        border: none !important;
        background: transparent !important;
        transition: all 0.2s ease !important;
    }
    .stTabs [data-baseweb="tab"]:hover {
        background: rgba(255, 255, 255, 0.7) !important;
        color: #0098DA !important;
    }
    .stTabs [aria-selected="true"] {
        background: #ffffff !important;
        color: #0098DA !important;
        box-shadow: 0 2px 8px rgba(0, 152, 218, 0.16) !important;
    }
    .stTabs [data-baseweb="tab-highlight"],
    .stTabs [data-baseweb="tab-border"] {
        display: none !important;
    }

    /* Metric Cards */
    .metric-card {
        background: #ffffff;
        border: 1px solid #e0f2fe;
        border-radius: 14px;
        padding: 16px 14px;
        text-align: center;
        box-shadow: 0 4px 12px rgba(0, 152, 218, 0.04);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        margin-bottom: 12px;
    }
    .metric-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 152, 218, 0.1);
    }
    .metric-val {
        font-size: 22px;
        font-weight: 700;
        color: #0f172a;
        margin-top: 4px;
    }
    .metric-label {
        font-size: 12.5px;
        color: #64748b;
        font-weight: 500;
    }

    /* File Uploader Clean Styling */
    [data-testid="stFileUploader"] {
        background: #ffffff;
        border: 1px solid #e0f2fe;
        border-radius: 14px;
        padding: 12px;
        box-shadow: 0 4px 12px rgba(0, 152, 218, 0.03);
    }
    [data-testid="stFileUploaderDropzone"] {
        border: 2px dashed #0098DA !important;
        background: #f8fafc !important;
        border-radius: 12px !important;
        padding: 20px 14px !important;
        transition: all 0.2s ease !important;
    }
    [data-testid="stFileUploaderDropzone"]:hover {
        border-color: #0284c7 !important;
        background: #f0f9ff !important;
    }

    /* Tip Box */
    .tip-box {
        background: #eff6ff;
        border-left: 4px solid #0098DA;
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 14px;
        font-size: 13px;
        color: #1e3a8a;
    }

    /* Mobile Responsive Optimizations (< 768px) */
    @media (max-width: 768px) {
        .block-container {
            padding: 0.8rem 0.5rem 2rem 0.5rem !important;
        }
        .dental-header {
            padding: 10px 14px !important;
            margin-bottom: 10px !important;
            border-radius: 12px !important;
        }
        .dental-header img {
            height: 38px !important;
        }
        .dental-main-title {
            font-size: 16.5px !important;
        }
        .stTabs [data-baseweb="tab-list"] {
            gap: 4px !important;
            padding: 4px !important;
        }
        .stTabs [data-baseweb="tab"] {
            padding: 7px 8px !important;
            font-size: 12.5px !important;
            min-width: 44% !important;
        }
        .metric-card {
            padding: 12px 10px !important;
            margin-bottom: 8px !important;
        }
        .metric-val {
            font-size: 18px !important;
        }
        .tip-box {
            padding: 9px 12px !important;
            font-size: 12px !important;
        }
    }
</style>
""", unsafe_allow_html=True)

# ==========================================
# Hero Header (Clean, No messy badges/subtitles)
# ==========================================
logo_html = ""
if logo_base64:
    logo_html = f'<img src="data:image/jpeg;base64,{logo_base64}" style="height: 48px; object-fit: contain; border-radius: 6px;">'

st.markdown(f"""
<div class="dental-header">
    {logo_html}
    <div class="dental-main-title">
        ប្រព័ន្ធបញ្ចូលវិក្កយបត្រស្វ័យប្រវត្តិ (Batch AI)
    </div>
</div>
""", unsafe_allow_html=True)

# បង្ហាញការជូនដំណឹងពីការរៀនសូត្ររបស់ AI បើមាន
if "last_learned_msg" in st.session_state:
    st.info(st.session_state.pop("last_learned_msg"), icon="🧠")

# ==========================================
# អានទិន្នន័យ Excel បច្ចុប្បន្នជាមុន
# ==========================================
if os.path.exists(EXCEL_FILE):
    try:
        df_all = pd.read_excel(EXCEL_FILE, sheet_name=SHEET_NAME)
    except Exception:
        df_all = pd.DataFrame()
else:
    df_all = pd.DataFrame()

total_credit_all = df_all['Credit'].sum() if ('Credit' in df_all.columns and not df_all.empty) else 0
total_rows_all = len(df_all)

# ==========================================
# Sidebar: Logo & Quick Status
# ==========================================
with st.sidebar:
    if os.path.exists(LOGO_PATH):
        st.image(LOGO_PATH, use_container_width=True)
    
    st.markdown("---")
    st.markdown("### ⚙️ ព័ត៌មានប្រព័ន្ធ (System)")
    
    st.markdown(f"""
    <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 12px; margin-bottom: 12px;">
        <div style="font-size: 11px; color: #0284c7; font-weight: 700; text-transform: uppercase;">AI Service Status</div>
        <div style="font-size: 13px; font-weight: 600; color: #0369a1; margin-top: 3px; display: flex; align-items: center; gap: 6px;">
            <span>🟢</span> ភ្ជាប់ Gemini API រួចរាល់
        </div>
        <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
            រក្សាទុកទៅក្នុង {EXCEL_FILE}
        </div>
    </div>
    """, unsafe_allow_html=True)

    selected_model = st.selectbox(
        "AI Model (ណែនាំ Flash-Lite):",
        CANDIDATE_MODELS,
        index=0,
        key="sidebar_model_select"
    )

    st.metric("ប្រតិបត្តិការបច្ចុប្បន្ន", f"{total_rows_all} ជួរ")

    if os.path.exists(EXCEL_FILE):
        with open(EXCEL_FILE, "rb") as f:
            sidebar_excel_bytes = f.read()
        st.download_button(
            label=f"📥 ទាញយក {EXCEL_FILE}",
            data=sidebar_excel_bytes,
            file_name=EXCEL_FILE,
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True,
            key="sidebar_dl_btn"
        )

# ==========================================
# ផ្ទាំងមេទាំង ៤ (4 Main Navigation Tabs)
# ==========================================
tab_home, tab_input, tab_list, tab_settings = st.tabs([
    "🏠 ទំព័រដើម",
    "📥 បញ្ចូលព័ត៌មាន",
    "📋 បញ្ជីទិន្នន័យ",
    "⚙️ ការកំណត់"
])

# ----------------------------------------------------
# TAB 1: 🏠 ទំព័រដើម (Dashboard Overview)
# ----------------------------------------------------
with tab_home:
    st.markdown("""
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
        <span style="font-size: 28px; line-height: 1;">📊</span>
        <h3 style="margin: 0; font-size: 19px; font-weight: 700; color: #0f172a;">ផ្ទាំងគ្រប់គ្រងទូទៅ (Dashboard Overview)</h3>
    </div>
    """, unsafe_allow_html=True)

    m1, m2, m3 = st.columns(3)
    with m1:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span style="font-size: 24px;">📄</span> <span>ប្រតិបត្តិការសរុបក្នុង Excel</span>
            </div>
            <div class="metric-val">{total_rows_all} ជួរ</div>
        </div>
        """, unsafe_allow_html=True)
    with m2:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span style="font-size: 24px;">🇰🇭</span> <span>Credit សរុប (KHR)</span>
            </div>
            <div class="metric-val" style="color: #16a34a;">{total_credit_all:,.0f} ៛</div>
        </div>
        """, unsafe_allow_html=True)
    with m3:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span style="font-size: 24px;">⚙️</span> <span>ស្ថានភាព Excel</span>
            </div>
            <div class="metric-val" style="color: #0098DA;">{'បានភ្ជាប់ជោគជ័យ' if os.path.exists(EXCEL_FILE) else 'រកមិនឃើញឯកសារ'}</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("""
    <div class="tip-box">
        💡 <strong>ការណែនាំរហ័ស (Quick Guide):</strong><br>
        • ចុចលើផ្ទាំង <strong>«📥 បញ្ចូលព័ត៌មាន»</strong> ដើម្បី Upload ឬ Paste រូបភាពវិក្កយបត្រពី Telegram រួចស្កេនដោយ AI<br>
        • ចុចលើផ្ទាំង <strong>«📋 បញ្ជីទិន្នន័យ»</strong> ដើម្បីពិនិត្យ កែសម្រួល ឬទាញយកឯកសារ Excel ទាំងអស់<br>
        • ចុចលើផ្ទាំង <strong>«⚙️ ការកំណត់»</strong> ដើម្បីពិនិត្យការចងចាំ (AI Memory) និងក្បួនស្កេន
    </div>
    """, unsafe_allow_html=True)

    if total_rows_all > 0:
        st.markdown("##### 🕒 ប្រតិបត្តិការចុងក្រោយក្នុង Excel (Recent Transactions)")
        recent_cols = [c for c in ["No.", "Date", "Vendor / Customer / Employee", "Description", "Credit", "Entry No", "JV No"] if c in df_all.columns]
        st.dataframe(df_all[recent_cols].tail(8), use_container_width=True, hide_index=True)
        
        if os.path.exists(EXCEL_FILE):
            with open(EXCEL_FILE, "rb") as f:
                home_excel_bytes = f.read()
            st.download_button(
                label=f"📥 ទាញយកឯកសារ {EXCEL_FILE}",
                data=home_excel_bytes,
                file_name=EXCEL_FILE,
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
                key="home_dl_btn"
            )

# ----------------------------------------------------
# TAB 2: 📥 បញ្ចូលព័ត៌មាន (Invoice Processing)
# ----------------------------------------------------
with tab_input:
    col_upload, col_result = st.columns([1, 1], gap="large")

    with col_upload:
        st.markdown("""
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <span style="font-size: 32px; line-height: 1;">📥</span>
            <h3 style="margin: 0; font-size: 19px; font-weight: 700; color: #0098DA;">១. ជ្រើសរើស ឬ Paste រូបភាពវិក្កយបត្រ</h3>
        </div>
        """, unsafe_allow_html=True)
        
        # ហៅ Paste Component (ភ្ជាប់ប៊ូតុង Paste ដោយផ្ទាល់ក្នុង Dropzone ខាងស្ដាំ មិនខាតទំហំ)
        paste_data = paste_zone_component(key="paste_zone_widget")
        
        # ទទួលរូបភាពដែល Paste ពី JavaScript
        if paste_data and isinstance(paste_data, dict) and "data" in paste_data:
            paste_ts = paste_data.get("timestamp", 0)
            if paste_ts > st.session_state.get("last_paste_timestamp", 0):
                st.session_state["last_paste_timestamp"] = paste_ts
                try:
                    data_url = paste_data["data"]
                    if "," in data_url:
                        encoded = data_url.split(",", 1)[1]
                    else:
                        encoded = data_url
                    img_bytes = base64.b64decode(encoded)
                    pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                    
                    if "pasted_images" not in st.session_state:
                        st.session_state["pasted_images"] = []
                        
                    cur_num = len(st.session_state["pasted_images"]) + 1
                    st.session_state["pasted_images"].append({
                        "id": paste_ts,
                        "name": f"Telegram_Paste_{cur_num}.png",
                        "image": pil_img
                    })
                    st.toast(f"✅ បាន Paste រូបភាពពី Telegram (សន្លឹកទី {cur_num}) ជោគជ័យ!", icon="📋")
                    st.rerun()
                except Exception as pe:
                    st.error(f"មានបញ្ហាក្នុងការបម្លែងរូបភាព Paste: {pe}")

        uploaded_files = st.file_uploader(
            "អូសទម្លាក់រូបភាពនៅទីនេះ ឬចុចប៊ូតុង Browse Files",
            type=["png", "jpg", "jpeg"],
            accept_multiple_files=True,
            help="អាច Upload រូបភាពវិក្កយបត្រជាច្រើនសន្លឹកក្នុងពេលតែមួយបាន"
        )
        
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

        p_count = len(st.session_state.get("pasted_images", []))
        u_count = len(uploaded_files) if uploaded_files else 0

        if all_images_to_process:
            detail_msg = []
            if p_count > 0:
                detail_msg.append(f"Telegram Paste: **{p_count}** សន្លឹក")
            if u_count > 0:
                detail_msg.append(f"File Upload: **{u_count}** សន្លឹក")
                
            st.success(f"📷 បានជ្រើសរើសរូបភាពសរុប **{len(all_images_to_process)}** សន្លឹក ({' + '.join(detail_msg)})")
            
            if p_count > 0:
                if st.button("🗑️ លុបរូបភាពដែលបាន Paste ពី Telegram ទាំងអស់", key="btn_clear_pasted"):
                    st.session_state["pasted_images"] = []
                    st.rerun()

            with st.expander(f"👁️ មើលរូបភាពទាំងអស់ ({len(all_images_to_process)} សន្លឹក)", expanded=(len(all_images_to_process) <= 4)):
                cols = st.columns(2)
                for idx, item in enumerate(all_images_to_process):
                    with cols[idx % 2]:
                        st.image(item["image"], caption=f"#{idx+1}: {item['name']} ({item['source']})", use_container_width=True)

    with col_result:
        st.markdown("""
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <span style="font-size: 32px; line-height: 1;">⚡</span>
            <h3 style="margin: 0; font-size: 19px; font-weight: 700; color: #0098DA;">២. វិភាគ និងកែប្រែទិន្នន័យ (Review & Edit)</h3>
        </div>
        """, unsafe_allow_html=True)
        
        if not all_images_to_process:
            st.markdown("""
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 16px 20px; display: flex; align-items: center; gap: 16px; margin-top: 4px;">
                <span style="font-size: 34px; line-height: 1;">👉</span>
                <div style="font-size: 14.5px; color: #0369a1; font-weight: 500;">
                    សូម <strong>Paste រូបភាពពី Telegram (Ctrl+V)</strong> ឬជ្រើសរើសឯកសារនៅផ្នែកខាងឆ្វេង ដើម្បីចាប់ផ្ដើម។
                </div>
            </div>
            """, unsafe_allow_html=True)
        else:
            num_files = len(all_images_to_process)
            btn_label = f"🚀 ១. ចាប់ផ្ដើមវិភាគរូបភាពដោយ AI ({num_files} សន្លឹក)"
            
            if st.button(btn_label, use_container_width=True, type="primary"):
                progress_bar = st.progress(0)
                status_text = st.empty()
                
                extracted_results = []
                successful_count = 0
                failed_count = 0
                
                # ទាញយក Memory និងចំណេះដឹងដែល AI បានរៀនសូត្រពីការកែសម្រួលរបស់អ្នកប្រើ
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
                1. ត្រង់ជួរ «អ្នកស្នើសុំ / អ្នកទទួល / Consignee»៖ សូមអានឈ្មោះមនុស្សដែលបានសរសេរដៃ ដាក់ចូល applicant_name (សម្រាប់ Vendor / Customer / Employee)
                2. ត្រង់ជួរ «បរិយាយ / Description»៖ សូមអានខ្លឹមសារទំនិញ ឬសេវាកម្មដែលបានសរសេរដៃ ដាក់ចូល description
                3. ត្រង់ជួរ «ចំនួនទឹកប្រាក់ / TOTAL PRICE / ថ្លៃសេវា»៖
                   - សូមអានលេខសរសេរដៃឱ្យបានច្បាស់លាស់បំផុត (រាប់ចំនួនខ្ទង់លេខឱ្យត្រឹមត្រូវ ដូចជា 6000, 5000, 8000, 10000...)
                   - ប្រយ័ត្នរវាងលេខ 6 និងលេខ 5 (លេខ 6 មានក្បាលកោងចុះមកក្រោមក្លាយជារង្វង់មូលបាតក្រោម, លេខ 5 មានបន្ទាត់ផ្តេកនៅផ្នែកលើ)
                   - កន្ទុយសញ្ញារៀល «៛» ឬអក្សរ «k» ឬសញ្ញាធីក (✓) នៅខាងលើ ឬខាងក្រោយលេខ មិនមែនជាលេខសូន្យទេ (ឧទាហរណ៍ 6000៛ គឺ 6000 មិនមែន 60,000 ទេ; 5000៛ គឺ 5000 មិនមែន 50,000 ទេ)
                បើមើលមិនឃើញ សូមដាក់ "N/A" ឬទទេរ។

                {memory_context}
                '''
                
                models_to_try = [selected_model] + [m for m in CANDIDATE_MODELS if m != selected_model]
                
                # គណនា No.
                if len(df_all) > 0 and 'No.' in df_all.columns and not df_all['No.'].dropna().empty:
                    try:
                        curr_no = int(df_all['No.'].dropna().iloc[-1]) + 1
                    except Exception:
                        curr_no = len(df_all) + 1
                else:
                    curr_no = 1

                # គណនា Entry No (start 57535)
                if len(df_all) > 0 and 'Entry No' in df_all.columns and not df_all['Entry No'].dropna().empty:
                    try:
                        curr_entry = int(df_all['Entry No'].dropna().iloc[-1]) + 1
                    except Exception:
                        curr_entry = 57535
                else:
                    curr_entry = 57535

                # គណនា JV No (start JV00581)
                if len(df_all) > 0 and 'JV No' in df_all.columns and not df_all['JV No'].dropna().empty:
                    try:
                        last_jv_str = str(df_all['JV No'].dropna().iloc[-1])
                        digits_part = ''.join(filter(str.isdigit, last_jv_str))
                        if digits_part:
                            curr_jv_num = int(digits_part) + 1
                        else:
                            curr_jv_num = 581
                    except Exception:
                        curr_jv_num = 581
                else:
                    curr_jv_num = 581
                
                for i, item in enumerate(all_images_to_process):
                    current_num = i + 1
                    status_text.markdown(f"⏳ **កំពុងវិភាគ (#{current_num}/{num_files}):** `{item['name']}` ({item['source']})...")
                    
                    img = item["image"]
                    success_this_file = False
                    last_err = ""
                    
                    for try_model_name in models_to_try:
                        try:
                            ai_model = genai.GenerativeModel(
                                try_model_name,
                                generation_config={"response_mime_type": "application/json"}
                            )
                            response = ai_model.generate_content([prompt, img])
                            
                            resp_text = response.text.strip()
                            if resp_text.startswith("```json"):
                                resp_text = resp_text[7:]
                            if resp_text.startswith("```"):
                                resp_text = resp_text[3:]
                            if resp_text.endswith("```"):
                                resp_text = resp_text[:-3]
                            resp_text = resp_text.strip()
                            
                            data = json.loads(resp_text)
                            
                            raw_amount = str(data.get("total_amount", "0")).replace(",", "").replace("$", "").strip()
                            try:
                                orig_amount = float(raw_amount)
                            except Exception:
                                orig_amount = 0.0
                                
                            raw_currency = str(data.get("currency", "USD")).upper()
                            if "KHR" in raw_currency or "រៀល" in raw_currency:
                                currency = "KHR"
                            else:
                                currency = "USD"
                                
                            date_val = data.get("date", "N/A")
                            if not date_val or date_val == "N/A":
                                date_val = datetime.date.today().strftime("%d-%b-%Y")
                                
                            # ទាញយក អ្នកស្នើសុំ -> Vendor / Customer
                            applicant_name = data.get("applicant_name") or data.get("receiver_name") or "N/A"
                            
                            # ទាញយក បរិយាយ -> Description
                            description_val = data.get("description")
                            if description_val == "N/A" or not description_val:
                                description_val = None
                            
                            # គណនា Credit (បើ USD គុណនឹង 4000)
                            if currency == "USD":
                                credit_amount = orig_amount * 4000
                            else:
                                credit_amount = orig_amount
                                
                            credit_val = int(credit_amount) if float(credit_amount).is_integer() else credit_amount
                            
                            extracted_results.append({
                                "No.": curr_no,
                                "Date": date_val,
                                "Source": "GL-JE",
                                "Entry No": curr_entry,
                                "JV No": f"JV{curr_jv_num:05d}",
                                "Reference": None,
                                "Class": "KHEMA88888",
                                "Vendor / Customer / Employee": applicant_name if applicant_name != "N/A" else None,
                                "Description": description_val,
                                "Debit": 0,
                                "Credit": credit_val,
                                "Balance": None,
                                "File": item["name"],
                                "Status": "ជោគជ័យ",
                                "raw_data": data
                            })
                            
                            curr_no += 1
                            curr_entry += 1
                            curr_jv_num += 1
                            successful_count += 1
                            success_this_file = True
                            break
                            
                        except Exception as err:
                            last_err = str(err)
                            continue
                    
                    if not success_this_file:
                        failed_count += 1
                        err_summary = "Quota Exceeded (429)" if "429" in last_err else last_err[:60]
                        extracted_results.append({
                            "No.": curr_no,
                            "Date": datetime.date.today().strftime("%d-%b-%Y"),
                            "Source": "GL-JE",
                            "Entry No": curr_entry,
                            "JV No": f"JV{curr_jv_num:05d}",
                            "Reference": None,
                            "Class": "KHEMA88888",
                            "Vendor / Customer / Employee": None,
                            "Description": None,
                            "Debit": 0,
                            "Credit": 0,
                            "Balance": None,
                            "File": item["name"],
                            "Status": f"បរាជ័យ: {err_summary}",
                            "raw_data": {}
                        })
                        curr_no += 1
                        curr_entry += 1
                        curr_jv_num += 1

                    progress_bar.progress(current_num / num_files)

                status_text.empty()
                st.session_state["pending_review_df"] = pd.DataFrame(extracted_results)
                st.session_state["pending_review_rows_raw"] = [r.copy() for r in extracted_results]
                st.session_state["review_ready"] = True
                st.success(f"✅ AI បានវិភាគចប់សព្វគ្រប់ ({successful_count}/{num_files} សន្លឹក)! សូមផ្ទៀងផ្ទាត់ ឬកែប្រែទិន្នន័យខាងក្រោមមុនពេលរក្សាទុក។")

        # ផ្ទាំងកែប្រែទិន្នន័យមុនពេលរក្សាទុក (Data Editor)
        if st.session_state.get("review_ready") and "pending_review_df" in st.session_state:
            st.markdown("---")
            st.markdown("""
            <div class="tip-box">
                <strong>💡 របៀបកែប្រែទិន្នន័យ & បង្រៀន AI (Review, Edit & Auto-Learn):</strong><br>
                អ្នកអាច <strong>ចុចផ្ទាល់លើក្រឡាក្នុងតារាងខាងក្រោម</strong> ដើម្បីកែប្រែ (Description/បរិយាយ, Vendor/អ្នកស្នើសុំ, Credit/ទឹកប្រាក់)។<br>
                🧠 <strong>រាល់ការកែប្រែរបស់លោកអ្នក ប្រព័ន្ធ AI នឹងកត់ត្រា និងចងចាំដោយស្វ័យប្រវត្ត</strong> សម្រាប់ការស្កេនលើកក្រោយៗ!
            </div>
            """, unsafe_allow_html=True)
            
            review_df = st.session_state["pending_review_df"]
            
            display_cols = [
                "No.", "Date", "Vendor / Customer / Employee", "Description", "Credit", 
                "Entry No", "JV No", "Source", "Class", "File", "Status"
            ]
            valid_cols = [c for c in display_cols if c in review_df.columns]
            
            edited_review_df = st.data_editor(
                review_df[valid_cols],
                column_config={
                    "No.": st.column_config.NumberColumn("No.", disabled=True),
                    "Date": st.column_config.TextColumn("Date (កាលបរិច្ឆេទ)"),
                    "Vendor / Customer / Employee": st.column_config.TextColumn("Vendor / អ្នកស្នើសុំ"),
                    "Description": st.column_config.TextColumn("Description (បរិយាយ)"),
                    "Credit": st.column_config.NumberColumn("Credit (KHR ៛)", format="%d ៛", required=True),
                    "Entry No": st.column_config.NumberColumn("Entry No", disabled=True),
                    "JV No": st.column_config.TextColumn("JV No", disabled=True),
                    "Source": st.column_config.TextColumn("Source", disabled=True),
                    "Class": st.column_config.TextColumn("Class", disabled=True),
                    "File": st.column_config.TextColumn("File", disabled=True),
                    "Status": st.column_config.TextColumn("Status", disabled=True),
                },
                use_container_width=True,
                num_rows="dynamic",
                key="editor_pending_rows"
            )
            
            col_save, col_cancel = st.columns([2, 1])
            with col_save:
                if st.button("💾 ២. បញ្ជាក់ និងរក្សាទុកទិន្នន័យទាំងអស់ចូល Excel", use_container_width=True, type="primary"):
                    if os.path.exists(EXCEL_FILE):
                        try:
                            df_target = pd.read_excel(EXCEL_FILE, sheet_name=SHEET_NAME)
                            
                            # AI រៀនសូត្រពីការកែសម្រួលរបស់អ្នកប្រើ
                            learned_count = mm.learn_from_review_diff(
                                st.session_state.get("pending_review_rows_raw", []), 
                                edited_review_df
                            )
                            
                            rows_to_save = []
                            for _, row in edited_review_df.iterrows():
                                if "ជោគជ័យ" in str(row.get("Status", "")):
                                    rows_to_save.append({
                                        "No.": row.get("No."),
                                        "Date": row.get("Date"),
                                        "Source": row.get("Source", "GL-JE"),
                                        "Entry No": row.get("Entry No"),
                                        "JV No": row.get("JV No"),
                                        "Reference": None,
                                        "Class": row.get("Class", "KHEMA88888"),
                                        "Vendor / Customer / Employee": row.get("Vendor / Customer / Employee"),
                                        "Description": row.get("Description"),
                                        "Debit": 0,
                                        "Credit": row.get("Credit", 0),
                                        "Balance": None
                                    })
                            
                            if rows_to_save:
                                df_target = pd.concat([df_target, pd.DataFrame(rows_to_save)], ignore_index=True)
                                with pd.ExcelWriter(EXCEL_FILE, engine='openpyxl') as writer:
                                    df_target.to_excel(writer, sheet_name=SHEET_NAME, index=False)
                                    
                                mm.sync_memory_from_excel(df_target)

                                st.session_state["review_ready"] = False
                                st.session_state["last_saved_count"] = len(rows_to_save)
                                
                                if learned_count > 0:
                                    st.session_state["last_learned_msg"] = f"🎉 បានរក្សាទុកជោគជ័យ! 🧠 AI បានកត់ត្រា និងចងចាំការកែសម្រួលរបស់អ្នក {learned_count} ចំណុចសម្រាប់ការស្កេនលើកក្រោយៗ។"
                                else:
                                    st.session_state["last_learned_msg"] = f"🎉 បានរក្សាទុកទិន្នន័យចំនួន {len(rows_to_save)} ជួរទៅក្នុង `{EXCEL_FILE}` ដោយជោគជ័យ!"
                                    
                                st.balloons()
                                st.rerun()
                            else:
                                st.warning("មិនមានទិន្នន័យជោគជ័យសម្រាប់រក្សាទុកឡើយ។")
                        except Exception as save_err:
                            st.error(f"មានបញ្ហាក្នុងការរក្សាទុកចូល Excel: {save_err}")
            with col_cancel:
                if st.button("❌ លុបចោល", use_container_width=True):
                    st.session_state["review_ready"] = False
                    st.rerun()

# ----------------------------------------------------
# TAB 3: 📋 បញ្ជីទិន្នន័យ (Excel Data List & Editor)
# ----------------------------------------------------
with tab_list:
    st.markdown(f"""
    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 28px; line-height: 1;">📋</span>
            <h3 style="margin: 0; font-size: 19px; font-weight: 700; color: #0f172a;">
                បញ្ជីប្រតិបត្តិការក្នុង <span style="color: #0098DA; font-family: monospace;">{EXCEL_FILE}</span>
            </h3>
        </div>
    </div>
    """, unsafe_allow_html=True)

    if os.path.exists(EXCEL_FILE) and len(df_all) > 0:
        st.caption("💡 អ្នកអាចចុចលើក្រឡាណាមួយដើម្បីកែប្រែលេខ ឬអក្សរផ្ទាល់ រួចចុចប៊ូតុង «រក្សាទុកការកែប្រែក្នុង Excel» ខាងក្រោម។ AI នឹងរៀនសូត្រពីការកែប្រែទាំងនេះដោយស្វ័យប្រវត្ត!")
        
        search_q = st.text_input("🔍 ស្វែងរកក្នុងតារាង (Vendor, Description, ឬលេខ)...", key="search_excel_table")
        df_to_show = df_all
        if search_q.strip():
            q = search_q.strip().lower()
            mask = df_all.astype(str).apply(lambda row: row.str.lower().str.contains(q, na=False)).any(axis=1)
            df_to_show = df_all[mask]

        edited_excel_table = st.data_editor(
            df_to_show,
            use_container_width=True,
            num_rows="dynamic",
            key="excel_master_editor"
        )
        
        col_m_save, col_m_dl = st.columns([1, 1])
        with col_m_save:
            if st.button("💾 រក្សាទុកការកែប្រែក្នុង Excel នេះ", key="btn_save_master_excel", use_container_width=True, type="primary"):
                try:
                    learned_excel = mm.learn_from_excel_table_diff(df_all, edited_excel_table)
                    with pd.ExcelWriter(EXCEL_FILE, engine='openpyxl') as writer:
                        edited_excel_table.to_excel(writer, sheet_name=SHEET_NAME, index=False)
                    mm.sync_memory_from_excel(edited_excel_table)
                    
                    if learned_excel > 0:
                        st.session_state["last_learned_msg"] = f"✅ បានរក្សាទុកក្នុង Excel! 🧠 AI បានរៀនសូត្រ និងចងចាំការកែប្រែចំនួន {learned_excel} ចំណុចពីតារាងនេះ!"
                    else:
                        st.session_state["last_learned_msg"] = "✅ បានរក្សាទុកការកែប្រែទៅក្នុងឯកសារ Excel ជោគជ័យ!"
                    st.rerun()
                except Exception as e:
                    st.error(f"មិនអាចរក្សាទុកបាន៖ {e}")
        with col_m_dl:
            with open(EXCEL_FILE, "rb") as f:
                excel_bytes = f.read()
            st.download_button(
                label=f"📥 ទាញយកឯកសារ {EXCEL_FILE}",
                data=excel_bytes,
                file_name=EXCEL_FILE,
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
                key="list_dl_btn"
            )
    else:
        st.warning(f"មិនទាន់មានទិន្នន័យក្នុងឯកសារ `{EXCEL_FILE}` នៅឡើយទេ។")

# ----------------------------------------------------
# TAB 4: ⚙️ ការកំណត់ (Settings & AI Memory)
# ----------------------------------------------------
with tab_settings:
    st.markdown("### ⚙️ ការកំណត់ប្រព័ន្ធ & AI Memory (Settings)")
    
    st.markdown("""
    <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; color: #166534;">
        <strong>✨ ប្រព័ន្ធចងចាំស្វ័យប្រវត្ត (Self-Learning Memory):</strong><br>
        រាល់ពេលលោកអ្នកកែប្រែទិន្នន័យ (Vendor/អ្នកស្នើសុំ, Description/បរិយាយ, ឬ Credit/ចំនួនទឹកប្រាក់) ទាំងមុនពេលរក្សាទុក និងក្នុងតារាង Excel ប្រព័ន្ធ AI នឹង <strong>កត់ត្រា និងចងចាំភ្លាមៗ</strong> សម្រាប់ការស្កេនវិក្កយបត្រលើកក្រោយៗ ដោយមិនបាច់កែដដែលៗឡើយ!
    </div>
    """, unsafe_allow_html=True)
    
    mem = mm.load_memory()
    
    mem_col1, mem_col2, mem_col3, mem_col4 = st.columns(4)
    with mem_col1:
        st.metric("📌 ការកែសម្រួលដែលបានចងចាំ", f"{len(mem.get('corrections', []))} ចំណុច")
    with mem_col2:
        st.metric("👤 ឈ្មោះ Vendor ដែលស្គាល់", f"{len(mem.get('known_vendors', []))} នាក់")
    with mem_col3:
        st.metric("📝 បរិយាយដែលស្គាល់", f"{len(mem.get('known_descriptions', []))} មុខ")
    with mem_col4:
        st.metric("⚙️ ក្បួនច្បាប់ AI", f"{len(mem.get('custom_rules', []))} ក្បួន")
        
    st.markdown("---")
    
    sync_col1, sync_col2 = st.columns([1, 1])
    with sync_col1:
        if st.button("🔄 Sync ការចងចាំពីតារាង Excel បច្ចុប្បន្ន", use_container_width=True, key="settings_sync_btn"):
            if len(df_all) > 0:
                added = mm.sync_memory_from_excel(df_all)
                st.success(f"✅ បាន Sync ឈ្មោះ Vendor និង Description ថ្មីចំនួន {added} ចូលទៅក្នុង Memory របស់ AI រួចរាល់!")
                st.rerun()
            else:
                st.warning("មិនមានទិន្នន័យ Excel សម្រាប់ Sync ទេ។")
            
    with sync_col2:
        if st.button("🗑️ សម្អាតប្រវត្តិការកែសម្រួល (Reset History)", use_container_width=True, key="settings_reset_btn"):
            mm.clear_all_corrections()
            st.warning("⚠️ បានសម្អាតប្រវត្តិការកែសម្រួលរួចរាល់!")
            st.rerun()

    st.markdown("---")
    st.markdown("##### 📌 ១. ក្បួនច្បាប់ និងការណែនាំពិសេសសម្រាប់ AI (AI Instructions & Custom Rules)")
    
    rules = mem.get("custom_rules", [])
    if rules:
        for idx, r in enumerate(rules):
            r_col1, r_col2 = st.columns([8, 1])
            with r_col1:
                st.markdown(f"**{idx+1}.** {r}")
            with r_col2:
                if st.button("❌", key=f"del_rule_{idx}", help="លុបក្បួននេះ"):
                    mm.delete_custom_rule(idx)
                    st.rerun()
    else:
        st.info("មិនទាន់មានក្បួនកំណត់ពិសេសនៅឡើយទេ។")
        
    new_rule_input = st.text_input("✍️ បង្រៀន AI បន្ថែម (ឧ. ជួរ «អ្នកស្នើសុំ» ត្រូវយកឈ្មោះបុគ្គលិក, វិក្កយបត្រសាំងត្រូវដាក់ប្រេងម៉ាស៊ីន...):", key="input_new_rule")
    if st.button("➕ បន្ថែមក្បួនចងចាំថ្មីឱ្យ AI", type="secondary"):
        if new_rule_input:
            mm.add_custom_rule(new_rule_input)
            st.success("✅ បានបន្ថែមក្បួនថ្មីចូលក្នុងការចងចាំរបស់ AI រួចរាល់!")
            st.rerun()

    st.markdown("---")
    st.markdown("##### 📋 ២. តារាងប្រវត្តិការកែសម្រួលជាក់ស្ដែង (Learned Corrections History)")
    corrections_list = mem.get("corrections", [])
    if corrections_list:
        df_corr = pd.DataFrame(corrections_list)
        disp_corr_df = df_corr.rename(columns={
            "timestamp": "កាលបរិច្ឆេទ & ម៉ោង",
            "field": "ជួរឈរ (Field)",
            "original": "តម្លៃដើម AI អាន",
            "corrected": "តម្លៃកែសម្រួលត្រឹមត្រូវ",
            "reason": "កំណត់ចំណាំ / ឯកសារ"
        })
        st.dataframe(disp_corr_df, use_container_width=True)
    else:
        st.info("មិនទាន់មានប្រវត្តិការកែសម្រួលនៅឡើយទេ។ នៅពេលអ្នកកែប្រែទិន្នន័យក្នុងតារាង វានឹងបង្ហាញនៅទីនេះដោយស្វ័យប្រវត្ត។")

    st.markdown("---")
    st.markdown("##### 🏷️ ៣. បញ្ជីឈ្មោះអ្នកស្នើសុំ (Vendors) & បរិយាយ (Descriptions) ដែល AI បានចងចាំ")
    vk_col, dk_col = st.columns(2)
    with vk_col:
        st.markdown(f"**👤 ឈ្មោះ Vendor/អ្នកស្នើសុំ ({len(mem.get('known_vendors', []))} នាក់)៖**")
        with st.container(height=200):
            for v in mem.get("known_vendors", []):
                st.markdown(f"- `{v}`")
    with dk_col:
        st.markdown(f"**📝 បរិយាយ Description ({len(mem.get('known_descriptions', []))} មុខ)៖**")
        with st.container(height=200):
            for d in mem.get("known_descriptions", []):
                st.markdown(f"- `{d}`")
