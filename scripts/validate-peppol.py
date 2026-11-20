"""Verify generated XML with pinned UBL 2.1 XSD and OpenPeppol/CEN rules.

Reference directories are prepared by CI; validation never downloads a resource.
The XSD wrapper supplies the external CCTS/signature grammars which the Java
schema distribution resolves using catalogs. The UBL schemas are unchanged.
"""
import argparse
import json
import subprocess
from pathlib import Path
from lxml import etree
from saxonche import PySaxonProcessor

parser = argparse.ArgumentParser()
for name in ('peppol', 'schematron', 'ubl', 'ccts'):
    parser.add_argument('--' + name, type=Path, required=True)
args = parser.parse_args()
versions = {
    'peppol': '5df0eff7c8efafd7c79c0dacce55082d175db759',
    'schematron': '77dcd36c53d12ed786c144ece3b2af7694abdc56',
    'ubl': 'c98245e3631c3914663ce4cb4162b8d26aad1c02',
    'ccts': 'adf5c6b6c2a8c62be66502db8aef4c60ebb9c5a0',
}
for name, expected in versions.items():
    actual = subprocess.check_output(['git', '-C', str(getattr(args, name)), 'rev-parse', 'HEAD'], text=True).strip()
    if actual != expected:
        raise RuntimeError(f'{name} reference revision mismatch')

output = Path('test-results/peppol-xml')
output.mkdir(parents=True, exist_ok=True)
paths = sorted(output.glob('*.xml')) + sorted(Path('test-results/peppol-e2e').glob('*.xml'))
if not paths:
    raise RuntimeError('No generated XML samples to validate')
ns = '{http://www.w3.org/2001/XMLSchema}'
parts = [
    ('ph-xsds-ccts-cct-schemamodule', 'CCTS_CCT_SchemaModule.xsd'),
    ('ph-xsds-xmldsig', 'xmldsig-core-schema.xsd'),
    ('ph-xsds-xades132', 'XAdES01903v132-201601.xsd'),
    ('ph-xsds-xades141', 'XAdES01903v141-201601.xsd'),
]
schemas = {}
for name in ('Invoice', 'CreditNote'):
    root = etree.Element(ns + 'schema', targetNamespace=f'urn:oasis:names:specification:ubl:schema:xsd:{name}-2')
    for module, file in parts:
        source = (args.ccts / module / 'src/main/resources/schemas' / file).resolve()
        etree.SubElement(root, ns + 'import', namespace=etree.parse(str(source)).getroot().get('targetNamespace'), schemaLocation=source.as_uri())
    source = (args.ubl / 'ph-ubl21/src/main/resources/external/schemas/ubl21/maindoc' / f'UBL-{name}-2.1.xsd').resolve()
    etree.SubElement(root, ns + 'include', schemaLocation=source.as_uri())
    schemas[name] = etree.XMLSchema(root)

failures = []
results = {str(path): {'xsd': False, 'rules': []} for path in paths}
for path in paths:
    document = etree.parse(str(path), etree.XMLParser(resolve_entities=False, no_network=True))
    name = etree.QName(document.getroot()).localname
    results[str(path)]['xsd'] = schemas[name].validate(document)
    if results[str(path)]['xsd'] == (path.name == 'negative-schema.xml'):
        failures.append(f'{path}: {schemas[name].error_log}')
with PySaxonProcessor(license=False) as processor:
    xslt = processor.new_xslt30_processor()
    compiler = (args.schematron / 'trunk/schematron/code/iso_svrl_for_xslt2.xsl').resolve()
    for name in ('CEN-EN16931-UBL', 'PEPPOL-EN16931-UBL'):
        generated = (output / f'{name}.xsl').resolve()
        xslt.compile_stylesheet(stylesheet_file=str(compiler)).transform_to_file(source_file=str((args.peppol / 'rules/sch' / f'{name}.sch').resolve()), output_file=str(generated))
        validator = xslt.compile_stylesheet(stylesheet_file=str(generated))
        for path in paths:
            if path.name == 'negative-schema.xml':
                continue
            result = validator.transform_to_string(source_file=str(path.resolve()))
            svrl = etree.fromstring(result.encode())
            errors = svrl.xpath('//*[local-name()="failed-assert"]')
            results[str(path)]['rules'].extend(error.get('id') for error in errors)
            if errors and not path.name.startswith('negative-'):
                failures.append(f'{path}: {[error.get("id") for error in errors]}')
for path in paths:
    expected = {'negative-reference.xml': 'PEPPOL-EN16931-R003', 'negative-totals.xml': 'BR-CO-13', 'negative-schema.xml': 'XSD'}.get(path.name)
    if expected and expected != 'XSD' and expected not in results[str(path)]['rules']:
        failures.append(f'{path}: negative control did not detect {expected}')
    print(('EXPECTED REJECTION' if expected else 'PASS'), path.name, results[str(path)])
(output / 'validation.json').write_text(json.dumps({'references': versions, 'samples': results, 'failures': failures}, indent=2))
if failures:
    raise RuntimeError('\n'.join(failures))
print('PASS: UBL 2.1 schema, CEN EN16931 and Peppol BIS 3.0.21 validation')
