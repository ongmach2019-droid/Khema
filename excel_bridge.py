import sys
import os
import json
import datetime
import re
import pandas as pd
import memory_manager as mm

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stdin, 'reconfigure'):
    sys.stdin.reconfigure(encoding='utf-8')

EXCEL_FILE = os.path.join(os.path.dirname(__file__), "ABA_Transactions_Latest.xlsx")
SHEET_NAME = "ABA Transactions KHR"

def read_input_payload():
    if len(sys.argv) > 2:
        arg = sys.argv[2]
        if arg == "-" or arg == "stdin":
            return sys.stdin.read().strip()
        if os.path.exists(arg):
            with open(arg, "r", encoding="utf-8") as f:
                return f.read().strip()
        return arg
    return sys.stdin.read().strip()

def get_transactions():
    if not os.path.exists(EXCEL_FILE):
        print(json.dumps([]))
        return

    try:
        df = pd.read_excel(EXCEL_FILE, sheet_name=SHEET_NAME)
    except Exception as e:
        print(json.dumps([]))
        return

    transactions = []
    # Reverse order so latest entry is on top (Index 0)
    for idx, row in df.iloc[::-1].iterrows():
        entry_no = row.get("Entry No")
        entry_val = int(entry_no) if pd.notna(entry_no) else (idx + 1)
        jv_no = str(row.get("JV No", ""))
        vendor = str(row.get("Vendor / Customer / Employee", ""))
        if vendor == "nan" or not vendor.strip():
            vendor = "ចំណាយទូទៅ"
        desc = str(row.get("Description", ""))
        if desc == "nan":
            desc = ""
        date_val = str(row.get("Date", ""))
        credit_khr = float(row.get("Credit", 0)) if pd.notna(row.get("Credit")) else 0.0
        amount_usd = credit_khr / 4000.0

        transactions.append({
            "id": f"tx-{entry_val}-{idx}",
            "ref": jv_no if jv_no and jv_no != "nan" else f"JV-{entry_val}",
            "entryNo": entry_val,
            "jvNo": jv_no if jv_no != "nan" else "",
            "vendor": vendor,
            "vendorKh": vendor,
            "category": desc if desc else "ចំណាយទូទៅ",
            "categoryCode": "6010 - សម្ភារៈប្រើប្រាស់",
            "date": date_val if date_val != "nan" else datetime.date.today().strftime("%Y-%m-%d"),
            "time": "10:00 AM",
            "amountUSD": round(amount_usd, 2),
            "amountKHR": int(credit_khr),
            "vatUSD": 0,
            "type": "expense",
            "status": "paid",
            "statusTextKh": "បានបង់",
            "iconName": "receipt_long",
            "aiExplanation": desc if desc else "ប្រតិបត្តិការទូទាត់ទូទៅ",
            "ocrConfidence": 98
        })

    print(json.dumps(transactions, ensure_ascii=False))

def get_excel_rows():
    if not os.path.exists(EXCEL_FILE):
        print(json.dumps([]))
        return

    try:
        df = pd.read_excel(EXCEL_FILE, sheet_name=SHEET_NAME)
    except Exception as e:
        print(json.dumps([]))
        return

    rows = []
    # Present latest at top (reversed)
    for idx, row in df.iloc[::-1].iterrows():
        no_val = int(row.get("No.", idx + 1)) if pd.notna(row.get("No.")) else (idx + 1)
        entry_val = int(row.get("Entry No", 0)) if pd.notna(row.get("Entry No")) else 0
        jv_val = str(row.get("JV No", ""))
        if jv_val == "nan": jv_val = ""
        date_val = str(row.get("Date", ""))
        if date_val == "nan": date_val = ""
        source_val = str(row.get("Source", "GL-JE"))
        if source_val == "nan": source_val = "GL-JE"
        ref_val = str(row.get("Reference", ""))
        if ref_val == "nan": ref_val = ""
        class_val = str(row.get("Class", "KHEMA88888"))
        if class_val == "nan": class_val = "KHEMA88888"
        vendor_val = str(row.get("Vendor / Customer / Employee", ""))
        if vendor_val == "nan": vendor_val = ""
        desc_val = str(row.get("Description", ""))
        if desc_val == "nan": desc_val = ""
        debit_val = float(row.get("Debit", 0)) if pd.notna(row.get("Debit")) else 0.0
        credit_val = float(row.get("Credit", 0)) if pd.notna(row.get("Credit")) else 0.0

        rows.append({
            "no": no_val,
            "date": date_val,
            "source": source_val,
            "entryNo": entry_val,
            "jvNo": jv_val,
            "reference": ref_val,
            "class": class_val,
            "vendor": vendor_val,
            "description": desc_val,
            "debit": debit_val,
            "credit": credit_val,
            "balance": None
        })

    print(json.dumps(rows, ensure_ascii=False))

def compute_next_entry_and_jv(df):
    curr_entry = 57559
    if len(df) > 0 and 'Entry No' in df.columns:
        valid_entries = pd.to_numeric(df['Entry No'], errors='coerce').dropna()
        if not valid_entries.empty:
            curr_entry = int(valid_entries.max()) + 1

    curr_jv_num = 605
    if len(df) > 0 and 'JV No' in df.columns:
        jv_nums = []
        for val in df['JV No'].dropna():
            digs = re.findall(r'\d+', str(val))
            if digs:
                jv_nums.append(int(digs[-1]))
        if jv_nums:
            curr_jv_num = max(jv_nums) + 1

    return curr_entry, curr_jv_num

def save_transaction(tx_json_str):
    try:
        tx = json.loads(tx_json_str)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON: {e}"}))
        return

    try:
        df_target = pd.read_excel(EXCEL_FILE, sheet_name=SHEET_NAME) if os.path.exists(EXCEL_FILE) else pd.DataFrame()
        curr_no = (len(df_target) + 1) if len(df_target) > 0 else 1
        curr_entry, curr_jv_num = compute_next_entry_and_jv(df_target)

        vendor = tx.get("vendor") or tx.get("vendorKh") or "មិនស្គាល់"
        desc = tx.get("category") or tx.get("aiExplanation") or "ទិញសម្ភារៈ"
        credit_khr = int(tx.get("amountKHR", 0))
        if credit_khr == 0 and tx.get("amountUSD"):
            credit_khr = int(float(tx.get("amountUSD")) * 4000)

        date_val = tx.get("date") or datetime.date.today().strftime("%d-%b-%Y")

        new_row = {
            "No.": curr_no,
            "Date": date_val,
            "Source": "GL-JE",
            "Entry No": curr_entry,
            "JV No": f"JV{curr_jv_num:05d}",
            "Reference": None,
            "Class": "KHEMA88888",
            "Vendor / Customer / Employee": vendor,
            "Description": desc,
            "Debit": 0,
            "Credit": credit_khr,
            "Balance": None
        }

        df_target = pd.concat([df_target, pd.DataFrame([new_row])], ignore_index=True)
        with pd.ExcelWriter(EXCEL_FILE, engine='openpyxl') as writer:
            df_target.to_excel(writer, sheet_name=SHEET_NAME, index=False)

        mm.sync_memory_from_excel(df_target)
        print(json.dumps({"success": True, "entry": curr_entry, "jv": f"JV{curr_jv_num:05d}"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

def update_transaction(update_json_str):
    try:
        data = json.loads(update_json_str)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON: {e}"}))
        return

    try:
        if not os.path.exists(EXCEL_FILE):
            print(json.dumps({"success": False, "error": "Excel file not found"}))
            return

        df = pd.read_excel(EXCEL_FILE, sheet_name=SHEET_NAME)
        entry_target = data.get("entryNo")
        jv_target = str(data.get("jvNo") or data.get("ref") or "").strip()
        id_str = str(data.get("id") or "")
        match_idx = None

        if entry_target is not None:
            try:
                entry_num = int(entry_target)
                matches = df.index[df['Entry No'] == entry_num].tolist()
                if matches:
                    match_idx = matches[-1]
            except Exception:
                pass

        if match_idx is None and jv_target:
            matches = df.index[df['JV No'].astype(str).str.strip() == jv_target].tolist()
            if matches:
                match_idx = matches[-1]

        if match_idx is None and id_str:
            digs = re.findall(r'\d+', id_str)
            if digs:
                try:
                    num = int(digs[-1])
                    matches = df.index[df['Entry No'] == num].tolist()
                    if matches:
                        match_idx = matches[-1]
                except Exception:
                    pass

        if match_idx is None:
            print(json.dumps({"success": False, "error": "Transaction not found in Excel"}))
            return

        # Update fields
        if "vendor" in data or "vendorKh" in data:
            v = data.get("vendorKh") or data.get("vendor")
            if v: df.at[match_idx, 'Vendor / Customer / Employee'] = v

        if "category" in data or "description" in data:
            d = data.get("description") or data.get("category")
            if d: df.at[match_idx, 'Description'] = d

        if "date" in data:
            df.at[match_idx, 'Date'] = str(data['date'])

        if "amountKHR" in data and data["amountKHR"] is not None:
            df.at[match_idx, 'Credit'] = float(data["amountKHR"])
        elif "amountUSD" in data and data["amountUSD"] is not None:
            df.at[match_idx, 'Credit'] = float(data["amountUSD"]) * 4000

        with pd.ExcelWriter(EXCEL_FILE, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name=SHEET_NAME, index=False)

        mm.sync_memory_from_excel(df)
        print(json.dumps({"success": True, "updatedIndex": int(match_idx)}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

def delete_transaction(target_json_str):
    try:
        data = json.loads(target_json_str) if (target_json_str.startswith("{") or target_json_str.startswith("[")) else {"id": target_json_str}
    except Exception:
        data = {"id": target_json_str}

    try:
        if not os.path.exists(EXCEL_FILE):
            print(json.dumps({"success": False, "error": "Excel file not found"}))
            return

        df = pd.read_excel(EXCEL_FILE, sheet_name=SHEET_NAME)
        entry_target = data.get("entryNo")
        jv_target = str(data.get("jvNo") or data.get("ref") or "").strip()
        id_str = str(data.get("id") or "")
        match_idx = None

        if entry_target is not None:
            try:
                entry_num = int(entry_target)
                matches = df.index[df['Entry No'] == entry_num].tolist()
                if matches:
                    match_idx = matches[-1]
            except Exception:
                pass

        if match_idx is None and jv_target:
            matches = df.index[df['JV No'].astype(str).str.strip() == jv_target].tolist()
            if matches:
                match_idx = matches[-1]

        if match_idx is None and id_str:
            digs = re.findall(r'\d+', id_str)
            if digs:
                try:
                    num = int(digs[-1])
                    matches = df.index[df['Entry No'] == num].tolist()
                    if matches:
                        match_idx = matches[-1]
                except Exception:
                    pass

        if match_idx is None:
            print(json.dumps({"success": False, "error": "Transaction not found for deletion"}))
            return

        df = df.drop(index=match_idx).reset_index(drop=True)
        # Update No. column to be sequential 1..N
        df['No.'] = range(1, len(df) + 1)

        with pd.ExcelWriter(EXCEL_FILE, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name=SHEET_NAME, index=False)

        mm.sync_memory_from_excel(df)
        print(json.dumps({"success": True, "remainingRows": len(df)}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

def clear_all_transactions():
    try:
        empty_df = pd.DataFrame(columns=[
            "No.", "Date", "Source", "Entry No", "JV No", "Reference",
            "Class", "Vendor / Customer / Employee", "Description",
            "Debit", "Credit", "Balance"
        ])
        with pd.ExcelWriter(EXCEL_FILE, engine='openpyxl') as writer:
            empty_df.to_excel(writer, sheet_name=SHEET_NAME, index=False)
        mm.sync_memory_from_excel(empty_df)
        print(json.dumps({"success": True, "remainingRows": 0}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

def save_all_excel_rows(rows_json_str):
    try:
        rows = json.loads(rows_json_str)
        if not isinstance(rows, list):
            print(json.dumps({"success": False, "error": "Expected an array of rows"}))
            return
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON: {e}"}))
        return

    try:
        formatted_rows = []
        for idx, r in enumerate(rows):
            no_val = r.get("no") or (idx + 1)
            date_val = str(r.get("date") or datetime.date.today().strftime("%d-%b-%Y"))
            source_val = str(r.get("source") or "GL-JE")
            entry_val = r.get("entryNo")
            jv_val = str(r.get("jvNo") or "")
            ref_val = r.get("reference") or None
            class_val = str(r.get("class") or "KHEMA88888")
            vendor_val = str(r.get("vendor") or "")
            desc_val = str(r.get("description") or "")
            debit_val = float(r.get("debit", 0)) if r.get("debit") is not None else 0.0
            credit_val = float(r.get("credit", 0)) if r.get("credit") is not None else 0.0

            formatted_rows.append({
                "No.": no_val,
                "Date": date_val,
                "Source": source_val,
                "Entry No": entry_val,
                "JV No": jv_val,
                "Reference": ref_val,
                "Class": class_val,
                "Vendor / Customer / Employee": vendor_val,
                "Description": desc_val,
                "Debit": debit_val,
                "Credit": credit_val,
                "Balance": None
            })

        df = pd.DataFrame(formatted_rows)
        # Sort or preserve order, renumber No. sequentially 1..N
        df['No.'] = range(1, len(df) + 1)

        with pd.ExcelWriter(EXCEL_FILE, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name=SHEET_NAME, index=False)

        mm.sync_memory_from_excel(df)
        print(json.dumps({"success": True, "savedRows": len(df)}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

def get_memory_context():
    ctx = mm.get_prompt_memory_text()
    print(ctx)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "get_transactions":
            get_transactions()
        elif cmd == "get_excel_rows":
            get_excel_rows()
        elif cmd == "save_transaction":
            save_transaction(read_input_payload())
        elif cmd == "update_transaction":
            update_transaction(read_input_payload())
        elif cmd == "delete_transaction":
            delete_transaction(read_input_payload())
        elif cmd == "clear_all_transactions":
            clear_all_transactions()
        elif cmd == "save_all_excel_rows":
            save_all_excel_rows(read_input_payload())
        elif cmd == "get_memory_context":
            get_memory_context()
        elif cmd == "sync_memory":
            if os.path.exists(EXCEL_FILE):
                df = pd.read_excel(EXCEL_FILE, sheet_name=SHEET_NAME)
                res = mm.sync_memory_from_excel(df)
                print(json.dumps({"synced": res}))
            else:
                print(json.dumps({"synced": 0}))
        else:
            print(json.dumps({"error": f"Unknown command: {cmd}"}))
    else:
        print(json.dumps({"error": "No command provided"}))
