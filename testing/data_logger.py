#!/usr/bin/env python3
"""
Smart Door Lock - Motion Detection Data Logger
Captures serial data from ESP32 for testing and analysis
"""

import serial
import time
import csv
import json
from datetime import datetime
import os
import sys
import re

# Configuration
SERIAL_PORT = 'COM3'  # Change sesuai port ESP32 kamu (check di Device Manager)
BAUD_RATE = 115200
OUTPUT_DIR = 'test_data'

class MotionDataLogger:
    def __init__(self, port, baud_rate):
        self.port = port
        self.baud_rate = baud_rate
        self.ser = None
        self.csv_file = None
        self.csv_writer = None
        self.json_log = []
        self.test_session = datetime.now().strftime("%Y%m%d_%H%M%S")
        
    def connect(self):
        """Connect to ESP32 serial port"""
        try:
            self.ser = serial.Serial(self.port, self.baud_rate, timeout=1)
            print(f"✓ Connected to {self.port} at {self.baud_rate} baud")
            time.sleep(2)  # Wait for connection to stabilize
            return True
        except serial.SerialException as e:
            print(f"✗ Error connecting to {self.port}: {e}")
            print("\nAvailable ports:")
            self._list_ports()
            return False
    
    def _list_ports(self):
        """List available serial ports"""
        try:
            from serial.tools import list_ports
            ports = list_ports.comports()
            for port in ports:
                print(f"  - {port.device}: {port.description}")
        except:
            print("  (Install pyserial to auto-detect ports)")
    
    def setup_csv(self, test_name="general"):
        """Setup CSV file for logging"""
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        filename = f"{OUTPUT_DIR}/{self.test_session}_{test_name}.csv"
        
        self.csv_file = open(filename, 'w', newline='', encoding='utf-8')
        self.csv_writer = csv.writer(self.csv_file)
        
        # CSV Header
        self.csv_writer.writerow([
            'Timestamp',
            'Time_ms',
            'Variance',
            'Threshold',
            'Motion_Detected',
            'RSSI',
            'Door_Locked',
            'Connected_WiFi',
            'Raw_Line'
        ])
        
        print(f"✓ Logging to: {filename}")
        return filename
    
    def parse_line(self, line):
        """Parse serial line and extract data"""
        timestamp = datetime.now().isoformat()
        
        # Initialize default values
        data = {
            'timestamp': timestamp,
            'time_ms': None,
            'variance': None,
            'threshold': None,
            'motion': False,
            'rssi': None,
            'door_locked': None,
            'wifi': None,
            'raw': line
        }
        
        # Parse motion detection line
        # Example: ">>> MOTION DETECTED! var=0.1234 thr=0.0567"
        motion_match = re.search(r'MOTION DETECTED.*var=([\d.]+).*thr=([\d.]+)', line)
        if motion_match:
            data['motion'] = True
            data['variance'] = float(motion_match.group(1))
            data['threshold'] = float(motion_match.group(2))
        
        # Parse send data line
        # Example: "[SEND] OK var=0.123 thr=0.045 motion=YES door=LOCKED"
        send_match = re.search(r'\[SEND\].*var=([\d.]+).*thr=([\d.]+).*motion=(\w+).*door=(\w+)', line)
        if send_match:
            data['variance'] = float(send_match.group(1))
            data['threshold'] = float(send_match.group(2))
            data['motion'] = (send_match.group(3) == 'YES')
            data['door_locked'] = (send_match.group(4) == 'LOCKED')
        
        # Parse RSSI
        rssi_match = re.search(r'rssi["\']?\s*:\s*(-?\d+)', line, re.IGNORECASE)
        if rssi_match:
            data['rssi'] = int(rssi_match.group(1))
        
        # Parse WiFi status
        if 'Primary' in line or 'Hotspot' in line:
            if 'Primary' in line:
                data['wifi'] = 'Primary'
            elif 'Hotspot' in line:
                data['wifi'] = 'Hotspot'
        
        # Parse calibration
        if '[CAL]' in line:
            cal_match = re.search(r'Baseline=([\d.]+).*Threshold=([\d.]+)', line)
            if cal_match:
                data['threshold'] = float(cal_match.group(2))
        
        return data
    
    def log_data(self, data):
        """Write data to CSV"""
        if self.csv_writer:
            self.csv_writer.writerow([
                data['timestamp'],
                data['time_ms'],
                data['variance'],
                data['threshold'],
                data['motion'],
                data['rssi'],
                data['door_locked'],
                data['wifi'],
                data['raw']
            ])
            self.csv_file.flush()  # Ensure data is written immediately
    
    def run(self, test_name="general", duration_minutes=None):
        """Main logging loop"""
        if not self.connect():
            return False
        
        csv_filename = self.setup_csv(test_name)
        
        print("\n" + "="*60)
        print(f"  DATA LOGGER ACTIVE - Test: {test_name}")
        print("="*60)
        if duration_minutes:
            print(f"Duration: {duration_minutes} minutes")
        print("Press Ctrl+C to stop\n")
        
        start_time = time.time()
        line_count = 0
        motion_events = 0
        
        try:
            while True:
                # Check duration
                if duration_minutes:
                    elapsed = (time.time() - start_time) / 60
                    if elapsed >= duration_minutes:
                        print(f"\n✓ Test duration reached ({duration_minutes} min)")
                        break
                
                # Read serial line
                if self.ser.in_waiting > 0:
                    try:
                        line = self.ser.readline().decode('utf-8', errors='ignore').strip()
                        if line:
                            line_count += 1
                            
                            # Parse and log
                            data = self.parse_line(line)
                            self.log_data(data)
                            self.json_log.append(data)
                            
                            # Print interesting events
                            if data['motion']:
                                motion_events += 1
                                print(f"[{data['timestamp']}] 🚨 MOTION #{motion_events} | "
                                      f"var={data['variance']:.4f} thr={data['threshold']:.4f}")
                            elif '[SEND]' in line or '[CAL]' in line or 'MOTION' in line:
                                print(f"[{data['timestamp']}] {line[:80]}")
                            
                            # Status update every 100 lines
                            if line_count % 100 == 0:
                                elapsed = (time.time() - start_time) / 60
                                print(f"  ... {line_count} lines logged ({elapsed:.1f} min, {motion_events} motion events)")
                    
                    except UnicodeDecodeError:
                        pass  # Skip lines with encoding errors
                
                time.sleep(0.01)  # Small delay to prevent CPU overload
        
        except KeyboardInterrupt:
            print("\n\n✓ Logging stopped by user")
        
        finally:
            self.cleanup()
            self.save_summary(csv_filename, line_count, motion_events, start_time)
    
    def cleanup(self):
        """Close connections and files"""
        if self.csv_file:
            self.csv_file.close()
        if self.ser and self.ser.is_open:
            self.ser.close()
        print("✓ Connections closed")
    
    def save_summary(self, csv_filename, line_count, motion_events, start_time):
        """Save JSON summary"""
        duration = time.time() - start_time
        
        summary = {
            'test_session': self.test_session,
            'csv_file': csv_filename,
            'duration_seconds': duration,
            'lines_logged': line_count,
            'motion_events': motion_events,
            'start_time': datetime.fromtimestamp(start_time).isoformat(),
            'end_time': datetime.now().isoformat()
        }
        
        json_filename = csv_filename.replace('.csv', '_summary.json')
        with open(json_filename, 'w') as f:
            json.dump(summary, f, indent=2)
        
        print("\n" + "="*60)
        print("  LOGGING SUMMARY")
        print("="*60)
        print(f"Duration: {duration/60:.1f} minutes")
        print(f"Lines logged: {line_count}")
        print(f"Motion events: {motion_events}")
        print(f"CSV file: {csv_filename}")
        print(f"Summary: {json_filename}")
        print("="*60 + "\n")


def interactive_mode():
    """Interactive menu for choosing test type"""
    print("\n" + "="*60)
    print("  SMART DOOR LOCK - DATA LOGGER")
    print("="*60)
    print("\nSelect test type:")
    print("  1. Range Test (Distance)")
    print("  2. Angle Test (Field of View)")
    print("  3. Object Discrimination Test")
    print("  4. General Logging")
    print("  5. Custom Test Name")
    print("  0. Exit")
    
    choice = input("\nEnter choice (1-5): ").strip()
    
    test_names = {
        '1': 'range_test',
        '2': 'angle_test',
        '3': 'object_discrimination',
        '4': 'general',
        '5': None
    }
    
    if choice == '0':
        print("Goodbye!")
        sys.exit(0)
    
    test_name = test_names.get(choice, 'general')
    
    if choice == '5':
        test_name = input("Enter custom test name: ").strip().replace(' ', '_')
    
    # Duration
    duration_input = input("\nTest duration in minutes (press Enter for unlimited): ").strip()
    duration = float(duration_input) if duration_input else None
    
    # Port selection
    port = input(f"\nSerial port (default: {SERIAL_PORT}): ").strip()
    if not port:
        port = SERIAL_PORT
    
    return test_name, duration, port


def main():
    """Main entry point"""
    if len(sys.argv) > 1:
        # Command line mode
        test_name = sys.argv[1] if len(sys.argv) > 1 else "general"
        duration = float(sys.argv[2]) if len(sys.argv) > 2 else None
        port = sys.argv[3] if len(sys.argv) > 3 else SERIAL_PORT
    else:
        # Interactive mode
        test_name, duration, port = interactive_mode()
    
    logger = MotionDataLogger(port, BAUD_RATE)
    logger.run(test_name, duration)


if __name__ == "__main__":
    main()
