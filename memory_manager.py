import os
import json
import datetime
from typing import Dict, List, Any, Optional
import pandas as pd

MEMORY_FILE = os.path.join(os.path.dirname(__file__), "ai_memory.json")

def get_default_memory() -> Dict[str, Any]:
    return {
        "last_updated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "corrections": [],
        "known_vendors": [],
        "known_descriptions": [],
        "custom_rules": [
            "ទឹកប្រាក់ 5000៛ ត្រូវយក 5000 (សូន្យ ៣ ខ្ទង់) ដាច់ខាតកុំច្រឡំ 50000 ពីព្រោះកន្ទុយ «៛» គឺជាសញ្ញារៀល",
            "ជួរ «អ្នកស្នើសុំ៖» ត្រូវស្រង់យកឈ្មោះមនុស្ស/បុគ្គលិក ដាក់ចូលក្នុង Vendor / Customer / Employee",
            "ជួរ «បរិយាយ៖» ត្រូវស្រង់យកខ្លឹមសារទំនិញ/សេវាកម្ម ដាក់ចូលក្នុង Description"
        ]
    }

def load_memory() -> Dict[str, Any]:
    if not os.path.exists(MEMORY_FILE):
        mem = get_default_memory()
        save_memory(mem)
        return mem
    try:
        with open(MEMORY_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Ensure required keys exist
            if "corrections" not in data:
                data["corrections"] = []
            if "known_vendors" not in data:
                data["known_vendors"] = []
            if "known_descriptions" not in data:
                data["known_descriptions"] = []
            if "custom_rules" not in data:
                data["custom_rules"] = []
            return data
    except Exception as e:
        print(f"Error loading memory: {e}")
        return get_default_memory()

def save_memory(memory_data: Dict[str, Any]) -> bool:
    try:
        memory_data["last_updated"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(MEMORY_FILE, "w", encoding="utf-8") as f:
            json.dump(memory_data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving memory: {e}")
        return False

def record_correction(field: str, original_val: Any, corrected_val: Any, reason: str = "") -> bool:
    mem = load_memory()
    orig_str = str(original_val) if original_val is not None else ""
    corr_str = str(corrected_val) if corrected_val is not None else ""
    
    if orig_str.strip() == corr_str.strip():
        return False
        
    correction_entry = {
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "field": field,
        "original": orig_str,
        "corrected": corr_str,
        "reason": reason
    }
    
    # Avoid exact duplicate consecutively
    if mem["corrections"] and mem["corrections"][-1].get("original") == orig_str and mem["corrections"][-1].get("corrected") == corr_str and mem["corrections"][-1].get("field") == field:
        return False

    mem["corrections"].append(correction_entry)
    
    # Update known sets
    if field == "Vendor / Customer / Employee" and corr_str.strip():
        if corr_str.strip() not in mem["known_vendors"]:
            mem["known_vendors"].append(corr_str.strip())
            
    if field == "Description" and corr_str.strip():
        if corr_str.strip() not in mem["known_descriptions"]:
            mem["known_descriptions"].append(corr_str.strip())
            
    return save_memory(mem)

def learn_from_review_diff(original_rows: List[Dict[str, Any]], edited_df: pd.DataFrame) -> int:
    """Compares pre-save review rows with user edited dataframe and learns differences."""
    changes_count = 0
    mem = load_memory()
    
    # Track fields to check
    check_fields = ["Vendor / Customer / Employee", "Description", "Credit", "Date"]
    
    for idx, row in edited_df.iterrows():
        orig_match = None
        # Try to find corresponding original row by 'No.' or by index
        row_no = row.get("No.")
        for o in original_rows:
            if o.get("No.") == row_no:
                orig_match = o
                break
        if not orig_match and idx < len(original_rows):
            orig_match = original_rows[idx]
            
        if not orig_match:
            continue
            
        for f in check_fields:
            orig_val = orig_match.get(f)
            curr_val = row.get(f)
            
            orig_s = "" if pd.isna(orig_val) or orig_val is None else str(orig_val).strip()
            curr_s = "" if pd.isna(curr_val) or curr_val is None else str(curr_val).strip()
            
            if orig_s != curr_s and curr_s != "":
                changes_count += 1
                mem["corrections"].append({
                    "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "field": f,
                    "original": orig_s,
                    "corrected": curr_s,
                    "reason": f"កែសម្រួលមុនពេលរក្សាទុក (Entry: {row.get('Entry No', 'N/A')})"
                })
                
                if f == "Vendor / Customer / Employee" and curr_s not in mem["known_vendors"]:
                    mem["known_vendors"].append(curr_s)
                elif f == "Description" and curr_s not in mem["known_descriptions"]:
                    mem["known_descriptions"].append(curr_s)

    if changes_count > 0:
        save_memory(mem)
        
    return changes_count

def learn_from_excel_table_diff(df_before: pd.DataFrame, df_after: pd.DataFrame) -> int:
    """Compares before and after Excel tables and records modifications."""
    changes_count = 0
    mem = load_memory()
    
    # Check rows that exist in both
    min_len = min(len(df_before), len(df_after))
    columns_to_track = ["Vendor / Customer / Employee", "Description", "Credit", "Date"]
    
    for i in range(min_len):
        row_before = df_before.iloc[i]
        row_after = df_after.iloc[i]
        entry_info = row_after.get("Entry No", f"ជួរទី {i+1}")
        
        for col in columns_to_track:
            if col in df_before.columns and col in df_after.columns:
                val_before = row_before[col]
                val_after = row_after[col]
                
                s_before = "" if pd.isna(val_before) or val_before is None else str(val_before).strip()
                s_after = "" if pd.isna(val_after) or val_after is None else str(val_after).strip()
                
                if s_before != s_after and s_after != "":
                    changes_count += 1
                    mem["corrections"].append({
                        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "field": col,
                        "original": s_before,
                        "corrected": s_after,
                        "reason": f"កែសម្រួលផ្ទាល់ក្នុងតារាង Excel (Entry: {entry_info})"
                    })
                    if col == "Vendor / Customer / Employee" and s_after not in mem["known_vendors"]:
                        mem["known_vendors"].append(s_after)
                    elif col == "Description" and s_after not in mem["known_descriptions"]:
                        mem["known_descriptions"].append(s_after)

    # Check newly added rows in df_after
    if len(df_after) > len(df_before):
        for i in range(len(df_before), len(df_after)):
            row_new = df_after.iloc[i]
            v = row_new.get("Vendor / Customer / Employee")
            d = row_new.get("Description")
            if pd.notna(v) and str(v).strip() and str(v).strip() not in mem["known_vendors"]:
                mem["known_vendors"].append(str(v).strip())
                changes_count += 1
            if pd.notna(d) and str(d).strip() and str(d).strip() not in mem["known_descriptions"]:
                mem["known_descriptions"].append(str(d).strip())
                changes_count += 1

    if changes_count > 0:
        save_memory(mem)
        
    return changes_count

def sync_memory_from_excel(df: pd.DataFrame) -> int:
    """Harvests all valid non-null vendors and descriptions from Excel dataframe."""
    mem = load_memory()
    added_count = 0
    
    if "Vendor / Customer / Employee" in df.columns:
        for val in df["Vendor / Customer / Employee"].dropna().unique():
            val_str = str(val).strip()
            if val_str and val_str not in mem["known_vendors"]:
                mem["known_vendors"].append(val_str)
                added_count += 1
                
    if "Description" in df.columns:
        for val in df["Description"].dropna().unique():
            val_str = str(val).strip()
            if val_str and val_str not in mem["known_descriptions"]:
                mem["known_descriptions"].append(val_str)
                added_count += 1
                
    if added_count > 0:
        save_memory(mem)
        
    return added_count

def add_custom_rule(rule_text: str) -> bool:
    if not rule_text or not rule_text.strip():
        return False
    mem = load_memory()
    rule_clean = rule_text.strip()
    if rule_clean not in mem["custom_rules"]:
        mem["custom_rules"].append(rule_clean)
        return save_memory(mem)
    return True

def delete_custom_rule(index: int) -> bool:
    mem = load_memory()
    if 0 <= index < len(mem["custom_rules"]):
        mem["custom_rules"].pop(index)
        return save_memory(mem)
    return False

def clear_all_corrections() -> bool:
    mem = load_memory()
    mem["corrections"] = []
    return save_memory(mem)

def get_prompt_memory_text() -> str:
    """Generates dynamic context prompt for Gemini containing learned knowledge."""
    mem = load_memory()
    
    lines = []
    lines.append("🧠 ចំណេះដឹង និងការចងចាំពីការកែសម្រួលរបស់អ្នកប្រើប្រាស់ (AI Learned Memory from User Corrections)៖")
    
    # Custom Rules
    if mem.get("custom_rules"):
        lines.append("\n📌 ក្បួនច្បាប់សំខាន់ៗដែលអ្នកប្រើប្រាស់បានកំណត់ (Important Rules):")
        for i, rule in enumerate(mem["custom_rules"], 1):
            lines.append(f"  {i}. {rule}")
            
    # Known Vendors
    vendors = mem.get("known_vendors", [])
    if vendors:
        v_list = ", ".join(f'"{v}"' for v in vendors[-15:]) # Last 15 vendors
        lines.append(f"\n👤 បញ្ជីឈ្មោះអ្នកស្នើសុំ/Vendor ដែលធ្លាប់មានក្នុងប្រព័ន្ធ (Known Requesters/Vendors): [{v_list}]")
        lines.append("  -> ប្រសិនបើអក្សរសរសេរដៃត្រង់ «អ្នកស្នើសុំ» ស្រដៀងនឹងឈ្មោះខាងលើ សូមជ្រើសរើសឈ្មោះត្រឹមត្រូវនោះ។")

    # Known Descriptions
    descriptions = mem.get("known_descriptions", [])
    if descriptions:
        d_list = ", ".join(f'"{d}"' for d in descriptions[-15:]) # Last 15 descriptions
        lines.append(f"\n📝 បញ្ជីបរិយាយ/Description ដែលធ្លាប់មានក្នុងប្រព័ន្ធ (Known Descriptions): [{d_list}]")
        lines.append("  -> ប្រសិនបើអក្សរសរសេរដៃត្រង់ «បរិយាយ» ស្រដៀងនឹងពាក្យខាងលើ (ដូចជា ផ្ញើពុម្ភអេលីហ្វុង(កំពង់ឆ្នាំង), ស៊ីប៊ូត ការ៉ុង...) សូមជ្រើសរើសពាក្យត្រឹមត្រូវនោះ។")
        
    # Recent Corrections Sample
    corrections = mem.get("corrections", [])
    if corrections:
        lines.append("\n🔍 គំរូការកែតម្រូវជាក់ស្ដែងកន្លងមកពីអ្នកប្រើប្រាស់ (Recent User Corrections):")
        # Take last 6 corrections
        for corr in corrections[-6:]:
            f = corr.get("field", "")
            orig = corr.get("original", "")
            fixed = corr.get("corrected", "")
            reason = corr.get("reason", "")
            lines.append(f'  - {f}: កាលមុនអានច្រឡំជា "{orig}" ត្រូវបានកែតម្រូវត្រឹមត្រូវជា "{fixed}"' + (f' ({reason})' if reason else ''))

    lines.append("\n⚠️ ចំណាំ៖ សូមពិនិត្យមើលរូបភាព និងប្រៀបធៀបជាមួយការចងចាំខាងលើ ដើម្បីទាញយកទិន្នន័យឱ្យបានសុក្រឹតបំផុត!")
    return "\n".join(lines)
