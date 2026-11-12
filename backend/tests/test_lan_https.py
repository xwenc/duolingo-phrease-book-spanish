import importlib.util
from pathlib import Path
import stat
import pytest
from cryptography import x509
from cryptography.x509.oid import ExtendedKeyUsageOID

spec = importlib.util.spec_from_file_location('setup_lan_https', Path(__file__).resolve().parents[2] / 'scripts/setup-lan-https.py')
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


def test_generated_certificate_matches_ip_and_reuses_phone_ca(tmp_path):
    setup.issue('192.168.0.102', tmp_path)
    original_ca = (tmp_path / 'rootCA.crt').read_bytes()
    ca = x509.load_pem_x509_certificate(original_ca)
    leaf = x509.load_pem_x509_certificate((tmp_path / 'server.crt').read_bytes())
    leaf.verify_directly_issued_by(ca)
    assert ExtendedKeyUsageOID.SERVER_AUTH in leaf.extensions.get_extension_for_class(x509.ExtendedKeyUsage).value
    names = leaf.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
    assert 'localhost' in names.get_values_for_type(x509.DNSName)
    assert '192.168.0.102' in [str(value) for value in names.get_values_for_type(x509.IPAddress)]
    assert stat.S_IMODE((tmp_path / 'server.key').stat().st_mode) == 0o600
    assert stat.S_IMODE((tmp_path / 'rootCA-key.pem').stat().st_mode) == 0o600
    setup.issue('192.168.0.103', tmp_path)
    assert (tmp_path / 'rootCA.crt').read_bytes() == original_ca
    renewed = x509.load_pem_x509_certificate((tmp_path / 'server.crt').read_bytes())
    renewed.verify_directly_issued_by(ca)
    assert '192.168.0.103' in [str(value) for value in renewed.extensions.get_extension_for_class(x509.SubjectAlternativeName).value.get_values_for_type(x509.IPAddress)]


def test_does_not_replace_an_incomplete_ca(tmp_path):
    (tmp_path / 'rootCA.crt').write_text('preserve existing CA')
    with pytest.raises(ValueError, match='CA 文件不完整'):
        setup.issue('192.168.0.102', tmp_path)
    assert (tmp_path / 'rootCA.crt').read_text() == 'preserve existing CA'


@pytest.mark.parametrize('address', ['8.8.8.8', '0.0.0.0', '127.0.0.1', '::1'])
def test_requires_a_lan_ipv4_address(tmp_path, address):
    with pytest.raises(ValueError):
        setup.issue(address, tmp_path)
