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
    sock.setblocking(False) # Use non-blocking sockets to prevent recv timeouts
    
    print(f"[*] Target IP: {target_ip}:{port}")
    print("[*] Note: Do NOT use '127.0.0.1' as target, since Kamailio whitelist-skips localhost.")
    print("[*] Sending 50 SIP OPTIONS requests rapidly to trigger Pike module limit...")
    
    for i in range(1, 51):
        payload = make_sip_options(target_ip, i)
        try:
            sock.sendto(payload.encode('utf-8'), (target_ip, port))
        except Exception as e:
            print(f"[-] Send error: {e}")
            break
            
        # Try to read any immediate response without blocking
        try:
            while True:
                data, addr = sock.recvfrom(2048)
                resp = data.decode('utf-8', errors='ignore')
                first_line = resp.split('\r\n')[0]
                print(f"   [Recv] Req #{i}: {first_line}")
        except BlockingIOError:
            pass
        except Exception:
            pass
            
        time.sleep(0.005) # 5ms sleep to send all 50 requests in ~0.25s
        
    print("\n[*] Waiting 1 second for any delayed responses...")
    time.sleep(1.0)
    try:
        while True:
            data, addr = sock.recvfrom(2048)
            resp = data.decode('utf-8', errors='ignore')
            first_line = resp.split('\r\n')[0]
            print(f"   [Recv Delayed] {first_line}")
    except BlockingIOError:
        pass
    except Exception:
        pass
        
    print("\n[*] Sending final status check request...")
    payload = make_sip_options(target_ip, 99)
    try:
        sock.sendto(payload.encode('utf-8'), (target_ip, port))
    except Exception as e:
        print(f"[-] Send error: {e}")
        return
        
    # Wait up to 2.0 seconds for the final block confirmation
    start_time = time.time()
    received_final = False
    while time.time() - start_time < 2.0:
        try:
            data, addr = sock.recvfrom(2048)
            resp = data.decode('utf-8', errors='ignore')
            first_line = resp.split('\r\n')[0]
            print(f"   [Final Status Check] Response: {first_line}")
            if "403" in first_line:
                print("\n[+] SUCCESS! IP has been successfully blocked by Kamailio Pike module.")
                received_final = True
                break
        except BlockingIOError:
            time.sleep(0.05)
        except Exception:
            break
            
    if not received_final:
        print("\n[-] FAILED or NO RESPONSE. IP was not blocked, or Kamailio is not reachable on this IP.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_pike.py <YOUR_LAN_IP>")
        print("Example: python test_pike.py 192.168.1.5")
        sys.exit(1)
        
    test_pike(sys.argv[1])
