#!/usr/bin/env python3
"""Issue a private LAN certificate without changing any system trust settings."""
import argparse
from datetime import datetime, timedelta, timezone
import ipaddress
from pathlib import Path
import os
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

PROJECT = Path(__file__).resolve().parents[1]


def write_private(path, key):
    data = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'wb') as file:
        file.write(data)
    path.chmod(0o600)


def issue(ip, directory):
    address = ipaddress.ip_address(ip)
    if address.version != 4 or not address.is_private or address.is_loopback or address.is_unspecified or address.is_multicast:
        raise ValueError('请填写电脑的局域网 IP 地址')
    directory.mkdir(parents=True, exist_ok=True)
    directory.chmod(0o700)
    ca_key_file = directory / 'rootCA-key.pem'
    ca_file = directory / 'rootCA.crt'
    now = datetime.now(timezone.utc)
    if ca_key_file.exists() != ca_file.exists():
        raise ValueError('CA 文件不完整，请恢复缺失文件；不要覆盖已在手机信任的 CA')
    if ca_file.exists():
        ca_key = serialization.load_pem_private_key(ca_key_file.read_bytes(), password=None)
        ca = x509.load_pem_x509_certificate(ca_file.read_bytes())
        if ca.public_key().public_numbers() != ca_key.public_key().public_numbers():
            raise ValueError('CA 证书与私钥不匹配')
        if ca.not_valid_after_utc <= now:
            raise ValueError('CA 已过期，需要重新生成并在手机重新安装')
    else:
        ca_key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'HablaEspanol Local Development CA')])
        ca = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(ca_key.public_key())
              .serial_number(x509.random_serial_number()).not_valid_before(now - timedelta(minutes=5))
              .not_valid_after(now + timedelta(days=3650))
              .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
              .add_extension(x509.KeyUsage(digital_signature=False, content_commitment=False, key_encipherment=False,
                                          data_encipherment=False, key_agreement=False, key_cert_sign=True, crl_sign=True,
                                          encipher_only=None, decipher_only=None), critical=True)
              .add_extension(x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()), critical=False)
              .sign(ca_key, hashes.SHA256()))
        write_private(ca_key_file, ca_key)
        ca_file.write_bytes(ca.public_bytes(serialization.Encoding.PEM))
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    names = [x509.IPAddress(address), x509.DNSName('localhost'), x509.IPAddress(ipaddress.ip_address('127.0.0.1')), x509.IPAddress(ipaddress.ip_address('::1'))]
    certificate = (x509.CertificateBuilder()
                   .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, str(address))]))
                   .issuer_name(ca.subject).public_key(key.public_key()).serial_number(x509.random_serial_number())
                   .not_valid_before(now - timedelta(minutes=5)).not_valid_after(min(now + timedelta(days=90), ca.not_valid_after_utc))
                   .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
                   .add_extension(x509.SubjectAlternativeName(names), critical=False)
                   .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
                   .add_extension(x509.KeyUsage(digital_signature=True, content_commitment=False, key_encipherment=True,
                                               data_encipherment=False, key_agreement=False, key_cert_sign=False, crl_sign=False,
                                               encipher_only=None, decipher_only=None), critical=True)
                   .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()), critical=False)
                   .sign(ca_key, hashes.SHA256()))
    write_private(directory / 'server.key', key)
    (directory / 'server.crt').write_bytes(certificate.public_bytes(serialization.Encoding.PEM))
    return ca_file


def main():
    parser = argparse.ArgumentParser(description='生成手机局域网 HTTPS 证书，不安装系统信任')
    parser.add_argument('--ip', required=True, help='电脑局域网 IPv4 地址')
    parser.add_argument('--output', type=Path, default=PROJECT / '.local-test' / 'https')
    args = parser.parse_args()
    try:
        public_certificate = issue(args.ip, args.output.resolve())
    except (ValueError, OSError) as error:
        parser.exit(1, f'证书生成失败：{error}\n')
    print(f'HTTPS URL: https://{args.ip}:8443')
    print(f'Phone CA certificate: {public_certificate}')
    print('Only install rootCA.crt on the phone. Keep all private key files on this computer.')


if __name__ == '__main__':
    main()
