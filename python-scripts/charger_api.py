# python-scripts/charger_api.py

import argparse
import warnings
from cryptography.utils import CryptographyDeprecationWarning
warnings.filterwarnings("ignore", category=CryptographyDeprecationWarning)

import os

from scapy.layers.l2 import ARP, Ether
from scapy.sendrecv import srp

import socket
import logging
import requests
import urllib3
import json
import threading
import time
import random
import string
import sys

# Determine the absolute path to the logs directory
script_dir = os.path.dirname(os.path.abspath(__file__))
log_dir = os.path.join(script_dir, '..', 'logs')

# Suppress SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Create the logs directory if it doesn't exist
os.makedirs(log_dir, exist_ok=True)

# Define the log file path
log_file = os.path.join(log_dir, 'charger_api.log')

# Logging setup
logging.basicConfig(
    filename=log_file,
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)


# Configuration
IP_RANGE = '192.168.0.0/24'  # Adjust to match your network
USERNAME = 'Assembler'       # Username for login
PASSWORD = 'E2'              # Password for login
API_LOGIN_ENDPOINT = '/api/login.php'
API_GET_ENDPOINT = '/api/get.php'

# Update RAY_MAC_PREFIX based on actual Ray device MAC addresses
RAY_MAC_PREFIX = '02:df:9a'  # Example prefix; update as necessary

# Hostname prefix for Ray devices
RAY_HOSTNAME_PREFIX = 'ray-'

# List of known Ray Devices (Manually Specified)
KNOWN_RAY_DEVICES = [
    {
        "ip": "192.168.0.12",
        "hostname": "ray-021260097381201829"
    },
    # Add more known devices here if needed
]

def find_ray_units():
    """
    Scans the network to find Ray charger units based on MAC address prefix and hostname patterns.
    Returns a list of Ray units.
    """
    logging.info(f"Scanning the network for devices in range {IP_RANGE}...")

    # Create an ARP packet
    arp = ARP(pdst=IP_RANGE)
    # Create an Ethernet broadcast packet
    ether = Ether(dst="ff:ff:ff:ff:ff:ff")
    # Stack them
    packet = ether / arp

    try:
        # Send the packet and receive responses
        result = srp(packet, timeout=3, verbose=0)[0]
    except PermissionError:
        logging.error("Permission denied: You need to run this script as an administrator/root.")
        return []
    except Exception as e:
        logging.error(f"Error during ARP scan: {e}")
        return []

    ray_units = []

    for sent, received in result:
        ip_address = received.psrc
        mac_address = received.hwsrc.lower()

        try:
            # Attempt to resolve hostname
            hostname = socket.gethostbyaddr(ip_address)[0]
            logging.debug(f"Resolved hostname {hostname} for IP {ip_address}")
        except socket.herror:
            hostname = None
            logging.debug(f"Could not resolve hostname for IP {ip_address}")

        # Identify Ray devices by MAC prefix or hostname
        if mac_address.startswith(RAY_MAC_PREFIX) or (hostname and hostname.startswith(RAY_HOSTNAME_PREFIX)):
            logging.info(f"Found Ray device at IP: {ip_address}, MAC: {mac_address}, Hostname: {hostname or 'Unknown'}")
            ray_units.append({
                "ip": ip_address,
                "hostname": hostname or "Unknown"
            })
        else:
            logging.debug(f"Device at IP {ip_address} with MAC {mac_address} does not match Ray device criteria")

    if not ray_units:
        logging.warning("No Ray devices found via network scan.")
    else:
        logging.info(f"Ray units found: {ray_units}")

    return ray_units

def check_unit_ready(units):
    """
    Checks if all provided Ray units are ready by interacting with their APIs.
    Returns a list of device_info dictionaries.
    """
    logging.info("Starting API interaction to check unit readiness...")

    devices_info = []

    for unit in units:
        ip_address = unit['ip']
        hostname = unit.get('hostname', 'Unknown')
        logging.info(f"Checking IP: {ip_address} with hostname: {hostname}")

        login_url = f"https://{ip_address}{API_LOGIN_ENDPOINT}"
        get_url = f"https://{ip_address}{API_GET_ENDPOINT}"
        logging.info(f"Constructed login URL: {login_url}")
        logging.info(f"Constructed get URL: {get_url}")

        # Prepare the login request payload
        login_payload = {
            "version": 1,
            "login": {
                "username": USERNAME,
                "password": PASSWORD
            }
        }

        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Python-Requests'
        }

        try:
            # Create a session to maintain cookies
            session = requests.Session()
            session.verify = False  # Suppress SSL warnings
            session.headers.update(headers)

            # Send POST request to login and get the token
            logging.info("Sending POST request to login...")
            response = session.post(login_url, json=login_payload, timeout=30)
            response.raise_for_status()

            data = response.json()
            if 'login' in data and 'token' in data['login']:
                token = data['login']['token']
            else:
                logging.error(f"Login failed: {data.get('api_errors', 'Unknown error')}")
                continue

            logging.info(f"Received token: {token}")

            # Use the session and token to fetch the required information
            info = get_charger_info(session, ip_address, token)
            if info:
                logging.info(f"Successfully retrieved charger info for {ip_address}.")

                # Extract the desired information
                device_info = extract_device_info(ip_address, hostname, info)
                devices_info.append(device_info)

                logging.info(f"Retrieved info for device at IP: {ip_address}")

            else:
                logging.error("Failed to retrieve charger info.")
                continue

        except requests.exceptions.RequestException as e:
            logging.error(f"Error connecting to {login_url}: {str(e)}")
            continue

    return devices_info

def extract_device_info(ip_address, hostname, info):
    """
    Extracts device information from the retrieved data.
    """
    # Fields from 'info'
    system_ip = info.get('System IP Address', 'N/A')
    hostname_info = info.get('Hostname', hostname)
    system_temp = info.get('System Temperature', 'N/A')
    charger_vendor = info.get('Charger Vendor', 'N/A')
    charger_model = info.get('Charger Model', 'N/A')

    # Additional fields from 'evse_info'
    ac_voltage = info.get('AC Voltage', 'N/A')
    status = info.get('Status', 'N/A')
    available_power = info.get('Available Power', 'N/A')
    current = info.get('Current', 'N/A')
    current_offered = info.get('Current Offered', 'N/A')
    energy = info.get('Energy', 'N/A')
    evse_connector_type = info.get('EVSE Connector Type', 'N/A')
    evse_pp_state = info.get('EVSE PP State', 'N/A')

    # Compile results
    device_info = {
        "ip": ip_address,
        "system_ip": system_ip,
        "hostname_info": hostname_info,
        "system_temp": system_temp,
        "charger_vendor": charger_vendor,
        "charger_model": charger_model,
        "ac_voltage": ac_voltage,
        "status": status,
        "available_power": available_power,
        "current": current,
        "current_offered": current_offered,
        "energy": energy,
        "evse_connector_type": evse_connector_type,
        "evse_pp_state": evse_pp_state,
        "success": True
    }

    return device_info

def get_charger_info(session, ip_address, token):
    """
    Retrieves charger information using the provided session and token.
    """
    # Construct the API URL for fetching info
    api_get_url = f"https://{ip_address}{API_GET_ENDPOINT}"

    # Prepare the POST payload
    get_payload = {
        "version": 1,
        "token": token,
        "settings": [
            "info"
        ]
    }

    try:
        logging.info(f"Sending POST request to {api_get_url} to fetch charger info...")
        # Use the session to make the POST request
        response = session.post(api_get_url, json=get_payload, timeout=30)
        response.raise_for_status()
        data = response.json()
        logging.debug(f"Get response data: {data}")

        # Check if 'settings' and 'info' are in the response
        settings = data.get('settings')
        if not settings or not isinstance(settings, dict):
            logging.error("Settings not found or invalid in the response.")
            logging.error(f"API Errors: {data.get('api_errors')}")
            return None

        info = settings.get('info', {})
        if not info:
            logging.error("Info not found in the response.")
            return None

        # Extract 'EVSEs' data
        evses = info.get('EVSEs', {})
        # Assuming only one EVSE, get the first one
        evse_key = next(iter(evses), None)
        if evse_key:
            evse_info = evses[evse_key]
        else:
            logging.error("No EVSE data found.")
            evse_info = {}

        # Combine 'info' and 'evse_info' into a single dictionary
        combined_info = {**info, **evse_info}

        return combined_info

    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching charger info: {str(e)}")
        return None

def configure_charger(option):
    """
    Configures the charger based on the provided option.
    """
    logging.info(f"Configuring charger with option: {option}")
    try:
        # Placeholder for actual configuration logic
        time.sleep(1)  # Simulate time taken to configure
        logging.info("Charger configured successfully.")
        return True
    except Exception as e:
        logging.error(f"Error in configure_charger: {e}")
        return False

def allocate_id():
    """
    Allocates a unique ID to a charger unit.
    """
    logging.info("Allocating ID to charger unit.")
    try:
        unique_id = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        logging.info(f"Allocated ID: {unique_id}")
        return unique_id
    except Exception as e:
        logging.error(f"Error in allocate_id: {e}")
        return None

def generate_password(length=12):
    """
    Generates a secure random password.
    """
    logging.info("Generating secure password.")
    try:
        characters = string.ascii_letters + string.digits + string.punctuation
        password = ''.join(random.choices(characters, k=length))
        logging.info("Password generated successfully.")
        return password
    except Exception as e:
        logging.error(f"Error in generate_password: {e}")
        return None

def generate_label():
    """
    Generates a label for a charger unit.
    """
    logging.info("Generating label for charger unit.")
    try:
        labels = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']
        label = random.choice(labels) + '-' + ''.join(random.choices(string.digits, k=3))
        logging.info(f"Generated label: {label}")
        return label
    except Exception as e:
        logging.error(f"Error in generate_label: {e}")
        return None

def start_software_update():
    """
    Initiates a software update for all charger units.
    """
    logging.info("Starting software update for all charger units.")
    try:
        units = find_ray_units()
        if not units:
            logging.warning("No Ray units found to update.")
            return False

        for unit in units:
            # Placeholder for actual update logic
            logging.info(f"Updating unit: {unit['hostname']} at {unit['ip']}")
            time.sleep(2)  # Simulate time taken to update
        logging.info("Software update completed successfully.")
        return True
    except Exception as e:
        logging.error(f"Error in start_software_update: {e}")
        return False

def process_known_ray_devices():
    """
    Processes the known Ray devices manually if not found via network scan.
    """
    logging.info("Processing the known 'ray' devices manually.")
    for ray_device in KNOWN_RAY_DEVICES:
        ip_address = ray_device["ip"]
        hostname = ray_device.get("hostname", "Unknown")
        logging.info(f"Processing known Ray device - IP: {ip_address}, Hostname: {hostname}")
        check_unit_ready([ray_device])

def start_charger_monitoring():
    """
    Continuously monitors charger status and emits updates via stdout in JSON format.
    This replaces the previous SocketIO-based communication.
    """
    def monitor():
        previous_units = set()

        while True:
            try:
                ray_units = find_ray_units()
                current_units = set(unit['ip'] for unit in ray_units)

                # Detect removed chargers
                removed_units = previous_units - current_units
                for ip in removed_units:
                    logging.info(f"Charger at IP {ip} removed.")
                    # Emit JSON message
                    message = {'event': 'charger_removed', 'ip': ip}
                    print(json.dumps(message))
                    sys.stdout.flush()

                # Update the previous_units set
                previous_units = current_units.copy()

                if ray_units:
                    devices_info = check_unit_ready(ray_units)
                    # Emit JSON messages for each charger status update
                    for device_info in devices_info:
                        message = {'event': 'charger_status_update', 'data': device_info}
                        print(json.dumps(message))
                        sys.stdout.flush()
                else:
                    if KNOWN_RAY_DEVICES:
                        logging.info("No 'ray' devices found via scan. Proceeding with known devices.")
                        devices_info = check_unit_ready(KNOWN_RAY_DEVICES)
                        for device_info in devices_info:
                            message = {'event': 'charger_status_update', 'data': device_info}
                            print(json.dumps(message))
                            sys.stdout.flush()
                    else:
                        logging.error("No 'ray' devices found via scan and no known devices are specified.")
                # Wait before the next scan
                time.sleep(3)  # Adjust the interval as needed
            except Exception as e:
                logging.error(f"Error in charger monitoring: {e}")
                time.sleep(3)  # Wait before retrying in case of error

    # Start the monitoring loop
    monitor()

def main():
    """
    Main entry point for the script.
    Handles argument parsing and mode selection.
    """
    parser = argparse.ArgumentParser(description='Charger API Script')
    parser.add_argument('--monitor', action='store_true', help='Start monitoring chargers continuously')

    args = parser.parse_args()

    if args.monitor:
        logging.info("Starting charger monitoring in continuous mode.")
        start_charger_monitoring()
    else:
        logging.info("Running charger API in single-run mode.")
        # Find Ray units on the network
        ray_units = find_ray_units()
        devices_info = []

        if ray_units:
            # Check unit readiness and collect device info
            devices_info = check_unit_ready(ray_units)
            # Print the collected device information
            output = {"devices": devices_info, "version": 2}
            print(json.dumps(output, indent=2))
        else:
            # If no 'ray' devices found, process known devices
            if KNOWN_RAY_DEVICES:
                logging.info("No 'ray' devices found via scan. Proceeding with known devices.")
                devices_info = check_unit_ready(KNOWN_RAY_DEVICES)
                if devices_info:
                    # Print the collected device information
                    output = {"devices": devices_info, "version": 2}
                    print(json.dumps(output, indent=2))
                else:
                    output = {"success": False, "message": "No devices found or failed to retrieve info.", "version": 2}
                    print(json.dumps(output, indent=2))
            else:
                # If no known devices, print an error message
                output = {"success": False, "message": "No devices found on the network.", "version": 2}
                print(json.dumps(output, indent=2))
                logging.error("No devices found on the network.")

if __name__ == '__main__':
    main()
