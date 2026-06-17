import xml.etree.ElementTree as ET


def get_text(node, tag_name):
    child = node.find(tag_name)
    if child is not None and child.text:
        return child.text.strip()
    return None


def read_ledgers(xml_file):
    tree = ET.parse(xml_file)
    root = tree.getroot()
    ledgers = []

    for ledger in root.iter():
        if ledger.tag.upper() != "LEDGER":
            continue

        name = ledger.attrib.get("NAME") or ledger.attrib.get("Name") or ledger.attrib.get("name")
        if not name:
            name = get_text(ledger, "NAME") or get_text(ledger, "Name") or get_text(ledger, "name")

        group_name = get_text(ledger, "PARENT") or get_text(ledger, "Parent") or get_text(ledger, "parent")
        if not group_name:
            group_name = get_text(ledger, "GROUP") or get_text(ledger, "Group") or get_text(ledger, "group")

        if name:
            ledgers.append({"name": name, "group_name": group_name or ""})

    return ledgers
