#!/usr/bin/env python3
"""Builds the "Scout Update" iPhone Shortcut (.shortcut plist) that fetches the PlayHQ pages
on the phone and posts them to the Scout app. Sign it on a Mac with:
  shortcuts sign --mode anyone --input "Scout Update.shortcut" --output "Scout Update signed.shortcut"
"""
import plistlib, uuid, sys

BASE = sys.argv[1] if len(sys.argv) > 1 else 'https://tigers-14-8-scout-7lp3.vercel.app'
KEY = sys.argv[2] if len(sys.argv) > 2 else 'tigers148'
OUT = sys.argv[3] if len(sys.argv) > 3 else 'Scout Update.shortcut'

def uid():
    return str(uuid.uuid4()).upper()

def out_ref(action_uuid, name):
    return {"Value": {"Type": "ActionOutput", "OutputUUID": action_uuid, "OutputName": name}, "WFSerializationType": "WFTextTokenAttachment"}

def var_ref(name):
    return {"Value": {"Type": "Variable", "VariableName": name}, "WFSerializationType": "WFTextTokenAttachment"}

def text_with(prefix, ref):
    # Text token string: prefix followed by one attachment
    return {"Value": {"string": prefix + "￼", "attachmentsByRange": {"{%d, 1}" % len(prefix): ref["Value"]}}, "WFSerializationType": "WFTextTokenString"}

actions = []

def get_url(url, u=None, method="GET", body_file=None):
    a = {"WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
         "WFWorkflowActionParameters": {"UUID": u or uid(), "WFURL": url, "WFHTTPMethod": method, "ShowHeaders": False}}
    if method == "POST":
        # JSON body {"html": <base64 text>}
        a["WFWorkflowActionParameters"]["WFHTTPBodyType"] = "JSON"
        a["WFWorkflowActionParameters"]["WFJSONValues"] = {"Value": {"WFDictionaryFieldValueItems": [{"WFItemType": 0,
            "WFKey": {"Value": {"string": "html", "attachmentsByRange": {}}, "WFSerializationType": "WFTextTokenString"},
            "WFValue": {"Value": {"string": "\ufffc", "attachmentsByRange": {"{0, 1}": body_file["Value"]}}, "WFSerializationType": "WFTextTokenString"}}]},
            "WFSerializationType": "WFDictionaryFieldValue"}
        a["WFWorkflowActionParameters"]["Advanced"] = True
    actions.append(a)
    return a["WFWorkflowActionParameters"]["UUID"]

def get_key(key, inp, u=None):
    a = {"WFWorkflowActionIdentifier": "is.workflow.actions.getvalueforkey",
         "WFWorkflowActionParameters": {"UUID": u or uid(), "WFGetDictionaryValueType": "Value", "WFDictionaryKey": key, "WFInput": inp}}
    actions.append(a)
    return a["WFWorkflowActionParameters"]["UUID"]

def fetch_and_post_loop(list_ref):
    gid = uid()
    actions.append({"WFWorkflowActionIdentifier": "is.workflow.actions.repeat.each",
                    "WFWorkflowActionParameters": {"GroupingIdentifier": gid, "WFControlFlowMode": 0, "WFInput": list_ref}})
    url_u = get_key("url", var_ref("Repeat Item"))
    page_u = get_url(text_with("", out_ref(url_u, "Dictionary Value")))
    b64_u = uid()
    actions.append({"WFWorkflowActionIdentifier": "is.workflow.actions.base64encode",
                    "WFWorkflowActionParameters": {"UUID": b64_u, "WFEncodeMode": "Encode", "WFBase64LineBreakMode": "None", "WFInput": out_ref(page_u, "Contents of URL")}})
    id_u = get_key("id", var_ref("Repeat Item"))
    get_url(text_with(BASE + "/api/ingest?k=" + KEY + "&page=", out_ref(id_u, "Dictionary Value")), method="POST", body_file=out_ref(b64_u, "Base64 Encoded"))
    actions.append({"WFWorkflowActionIdentifier": "is.workflow.actions.repeat.each",
                    "WFWorkflowActionParameters": {"GroupingIdentifier": gid, "WFControlFlowMode": 2}})

# 1. plan
plan_u = get_url(BASE + "/api/plan?k=" + KEY)
urls_u = get_key("urls", out_ref(plan_u, "Contents of URL"))
# 2. fetch each page and post it
fetch_and_post_loop(out_ref(urls_u, "Dictionary Value"))
# 3. finalize, which returns the game pages still needed
fin1_u = get_url(BASE + "/api/finalize?k=" + KEY)
more_u = get_key("more", out_ref(fin1_u, "Contents of URL"))
fetch_and_post_loop(out_ref(more_u, "Dictionary Value"))
# 4. finalize again and notify
fin2_u = get_url(BASE + "/api/finalize?k=" + KEY)
msg_u = get_key("message", out_ref(fin2_u, "Contents of URL"))
actions.append({"WFWorkflowActionIdentifier": "is.workflow.actions.notification",
                "WFWorkflowActionParameters": {"UUID": uid(), "WFNotificationActionBody": text_with("Scout: ", out_ref(msg_u, "Dictionary Value")), "WFNotificationActionSound": False}})

doc = {
    "WFWorkflowClientVersion": "2607.0.3",
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowMinimumClientVersionString": "900",
    "WFWorkflowIcon": {"WFWorkflowIconStartColor": 4274264319, "WFWorkflowIconGlyphNumber": 59511},
    "WFWorkflowImportQuestions": [],
    "WFWorkflowTypes": ["NCWidget", "WatchKit"],
    "WFWorkflowInputContentItemClasses": ["WFAppContentItem", "WFAppStoreAppContentItem", "WFArticleContentItem", "WFContactContentItem", "WFDateContentItem", "WFEmailAddressContentItem", "WFFolderContentItem", "WFGenericFileContentItem", "WFImageContentItem", "WFiTunesProductContentItem", "WFLocationContentItem", "WFDCMapsLinkContentItem", "WFAvePDFContentItem", "WFPDFContentItem", "WFPhoneNumberContentItem", "WFRichTextContentItem", "WFSafariWebPageContentItem", "WFStringContentItem", "WFURLContentItem"],
    "WFWorkflowHasShortcutInputVariables": False,
    "WFWorkflowHasOutputFallback": False,
    "WFWorkflowOutputContentItemClasses": [],
    "WFWorkflowActions": actions,
}
with open(OUT, 'wb') as f:
    plistlib.dump(doc, f, fmt=plistlib.FMT_XML)
print('wrote', OUT, 'with', len(actions), 'actions')
