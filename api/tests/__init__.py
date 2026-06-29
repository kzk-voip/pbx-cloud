import socket
import time
import sys

def make_sip_options(target_ip, cseq):
    return (
        f"OPTIONS sip:ping@{target_ip} SIP/2.0\r\n"
        f"Via: SIP/2.0/UDP 127.0.0.1:5099;branch=z9hG4bK-{cseq}\r\n"
        f"Max-Forwards: 70\r\n"
        f"To: <sip:ping@{target_ip}>\r\n"
        f"From: <sip:scanner@spammer.com>;tag=testpike{cseq}\r\n"
        f"Call-ID: pike-test-call-id-{cseq}@127.0.0.1\r\n"
        f"CSeq: {cseq} OPTIONS\r\n"
        f"Contact: <sip:scanner@127.0.0.1:5099>\r\n"
        f"Accept: application/sdp\r\n"
        f"Content-Length: 0\r\n\r\n"
    )

def test_pike(target_ip):
    port = 5060
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(1.0)
    
    print(f"[*] Target IP: {target_ip}:{port}")
    print("[*] Note: Do NOT use '127.0.0.1' as target, since Kamailio whitelist-skips localhost.")
    print("[*] Sending 50 SIP OPTIONS requests rapidly to trigger Pike module limit...")
    
    blocked = False
    
    for i in range(1, 51):
        payload = make_sip_options(target_ip, i)
        sock.sendto(payload.encode('utf-8'), (target_ip, port))
        
        # Read incoming socket responses if any to see if we got blocked
        try:
            while True:
                data, addr = sock.recvfrom(2048)
                resp = data.decode('utf-8', errors='ignore')
                first_line = resp.split('\r\n')[0]
                print(f"   [Recv] Req #{i}: {first_line}")
                if "403" in first_line:
                    blocked = True
        except socket.timeout:
            pass
            
        time.sleep(0.01) # fast sleep to stay well within 2 seconds
        
    print("\n[*] Sending follow-up request to check block status...")
    payload = make_sip_options(target_ip, 99)
    sock.sendto(payload.encode('utf-8'), (target_ip, port))
    
    try:
        data, addr = sock.recvfrom(2048)
        resp = data.decode('utf-8', errors='ignore')
        first_line = resp.split('\r\n')[0]
        print(f"   [Final Status Check] Response: {first_line}")
        if "403" in first_line:
            print("\n[+] SUCCESS! IP has been successfully blocked by Kamailio Pike module.")
        else:
            print("\n[-] FAILED. IP was not blocked. Ensure you are targeting the LAN IP instead of 127.0.0.1.")
    except socket.timeout:
        print("\n[-] Timeout waiting for final status check. Kamailio might have silent-dropped the packet or server is offline.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_pike.py <YOUR_LAN_IP>")
        print("Example: python test_pike.py 192.168.1.5")
        sys.exit(1)
        
    test_pike(sys.argv[1])