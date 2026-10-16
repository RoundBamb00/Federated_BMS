# GUI.py
# BMS 24S 串口上位机
# 依赖:
#   pip install PyQt5 pyserial

import sys
import time
from dataclasses import dataclass
from typing import Dict, List, Optional

import serial
import serial.tools.list_ports

from PyQt5.QtCore import Qt, QThread, QTimer, pyqtSignal
from PyQt5.QtGui import QFont
from PyQt5.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QGridLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QProgressBar,
    QPushButton,
    QRadioButton,
    QStatusBar,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)


BAUDRATES = [9600, 19200, 38400, 57600, 115200]
DEFAULT_BAUDRATE = 115200

PACK_CELL_COUNT = 12
CURRENT_SCALE = 1.0

CMD_START_COLLECT = bytes([0x01, 0x02, 0x55])
CMD_STOP_COLLECT = bytes([0x01, 0x03, 0x55])
CMD_OPEN_DSG = bytes([0x01, 0x04, 0x55])
CMD_CLOSE_DSG = bytes([0x01, 0x05, 0x55])
CMD_OPEN_CHG = bytes([0x01, 0x06, 0x55])
CMD_CLOSE_CHG = bytes([0x01, 0x07, 0x55])


I18N = {
    "zh": {
        "window_title": "BMS 24S 串口上位机",
        "settings": "设置",
        "settings_title": "系统设置",
        "serial_group": "串口配置",
        "language_group": "语言设置",
        "debug_group": "调试设置",
        "summary_group": "24S 汇总",
        "control_group": "采集与充放电控制",
        "log_window_title": "运行日志",
        "log_output": "日志输出",
        "port": "串口",
        "baudrate": "波特率",
        "refresh_port": "刷新串口",
        "open_serial": "打开串口",
        "close_serial": "关闭串口",
        "same_header": "同帧头交替识别 PACK1 / PACK2",
        "language": "界面语言",
        "chinese": "中文",
        "english": "English",
        "ok": "确定",
        "cancel": "取消",
        "clear_log": "清空日志",
        "start": "开始采集",
        "stop": "停止采集",
        "open_dsg": "打开放电",
        "close_dsg": "关闭放电",
        "open_chg": "打开充电",
        "close_chg": "关闭充电",
        "clear_values": "清空参数",
        "exit": "退出软件",
        "total_voltage": "24S 总压",
        "avg_soc": "平均 SOC",
        "pack1_soc": "PACK1 SOC",
        "pack2_soc": "PACK2 SOC",
        "max_cell": "最高单体",
        "min_cell": "最低单体",
        "diff": "总压差",
        "pack_board": "12S 采集板",
        "soc": "SOC",
        "voltage_total": "总压",
        "current": "电流",
        "temp1": "Temp1",
        "temp2": "Temp2",
        "max": "MAX",
        "min": "MIN",
        "balance": "压差",
        "frame_len": "帧长",
        "byte": "字节",
        "footer": "BMS 24S 上位机",
        "connected": "已连接",
        "disconnected": "未连接",
        "serial_closed": "串口已关闭",
        "no_port": "未发现串口",
        "select_port": "请选择串口",
        "open_port_first": "请先打开串口",
        "no_available_port": "未发现可用串口",
        "message_title": "提示",
        "sent": "已发送",
        "received": "收到",
        "header": "帧头",
        "data": "数据",
        "settings_saved": "设置已更新",
        "values_cleared": "显示参数已清空",
        "serial_connected": "串口已连接",
        "parse_error": "数据解析错误",
        "frame_count": "帧数",
        "serial_open_notice": "串口已打开，请先关闭串口再修改端口或波特率。",
    },
    "en": {
        "window_title": "BMS 24S Serial Monitor",
        "settings": "Settings",
        "settings_title": "System Settings",
        "serial_group": "Serial Config",
        "language_group": "Language",
        "debug_group": "Debug",
        "summary_group": "24S Summary",
        "control_group": "Acquisition and MOS Control",
        "log_window_title": "Run Log",
        "log_output": "Log Output",
        "port": "Port",
        "baudrate": "Baudrate",
        "refresh_port": "Refresh",
        "open_serial": "Open Serial",
        "close_serial": "Close Serial",
        "same_header": "Alternate PACK1 / PACK2 With Same Header",
        "language": "Language",
        "chinese": "中文",
        "english": "English",
        "ok": "OK",
        "cancel": "Cancel",
        "clear_log": "Clear Log",
        "start": "Start",
        "stop": "Stop",
        "open_dsg": "Open Discharge Contactor",
        "close_dsg": "Close Discharge Contactor",
        "open_chg": "Open Charge Contactor",
        "close_chg": "Close Charge Contactor",
        "clear_values": "Clear Values",
        "exit": "Exit",
        "total_voltage": "24S Voltage",
        "avg_soc": "Avg SOC",
        "pack1_soc": "PACK1 SOC",
        "pack2_soc": "PACK2 SOC",
        "max_cell": "Max Cell",
        "min_cell": "Min Cell",
        "diff": "Delta",
        "pack_board": "12S Board",
        "soc": "SOC",
        "voltage_total": "Total V",
        "current": "Current",
        "temp1": "Temp1",
        "temp2": "Temp2",
        "max": "MAX",
        "min": "MIN",
        "balance": "Delta",
        "frame_len": "Frame Len",
        "byte": "Byte",
        "footer": "BMS 24S Monitor",
        "connected": "Connected",
        "disconnected": "Disconnected",
        "serial_closed": "Serial closed",
        "no_port": "No serial port found",
        "select_port": "Please select a serial port",
        "open_port_first": "Please open the serial port first",
        "no_available_port": "No available serial port found",
        "message_title": "Notice",
        "sent": "Sent",
        "received": "Received",
        "header": "Header",
        "data": "Data",
        "settings_saved": "Settings updated",
        "values_cleared": "Displayed values cleared",
        "serial_connected": "Serial connected",
        "parse_error": "Data parse error",
        "frame_count": "Frames",
        "serial_open_notice": "Serial is open. Close it before changing port or baudrate.",
    },
}


def u16_be(data: bytes, index: int) -> int:
    return (data[index] << 8) | data[index + 1]


def i16_be(data: bytes, index: int) -> int:
    value = u16_be(data, index)
    if value >= 0x8000:
        value -= 0x10000
    return value


def i8(value: int) -> int:
    return value - 256 if value >= 128 else value


@dataclass
class PackData:
    pack_index: int
    header_id: int
    cells_mv: List[Optional[int]]
    total_mv: Optional[int]
    soc: Optional[int]
    current_a: Optional[float]
    temp1: Optional[int]
    temp2: Optional[int]
    dsg_on: Optional[bool]
    chg_on: Optional[bool]
    max_mv: Optional[int]
    min_mv: Optional[int]
    raw_len: int


class BmsFrameParser:
    FRAME_LEN_12S_SHORT = 40
    FRAME_LEN_15S_LEGACY = 46

    def __init__(self):
        self.buffer = bytearray()

    def feed(self, data: bytes) -> List[bytes]:
        self.buffer.extend(data)
        frames: List[bytes] = []

        while True:
            header_pos = self.find_header(self.buffer)

            if header_pos < 0:
                if len(self.buffer) > 512:
                    self.buffer.clear()
                return frames

            if header_pos > 0:
                del self.buffer[:header_pos]

            if len(self.buffer) < self.FRAME_LEN_12S_SHORT:
                return frames

            next_header = self.find_header(self.buffer, start=2)

            if next_header in (self.FRAME_LEN_12S_SHORT, self.FRAME_LEN_15S_LEGACY):
                frame_len = next_header
            elif len(self.buffer) >= self.FRAME_LEN_15S_LEGACY:
                frame_len = self.FRAME_LEN_15S_LEGACY
            else:
                return frames

            raw = bytes(self.buffer[:frame_len])
            del self.buffer[:frame_len]
            frames.append(raw)

    @staticmethod
    def find_header(buf: bytearray, start: int = 0) -> int:
        for i in range(start, len(buf) - 1):
            if buf[i] == 0xAA and 0x01 <= buf[i + 1] <= 0x10:
                return i
        return -1

    @staticmethod
    def parse_pack_frame(raw: bytes, pack_index: int) -> PackData:
        if len(raw) not in (BmsFrameParser.FRAME_LEN_12S_SHORT, BmsFrameParser.FRAME_LEN_15S_LEGACY):
            raise ValueError(f"Unsupported frame length: {len(raw)}")

        if raw[0] != 0xAA:
            raise ValueError("Bad frame header")

        header_id = raw[1]
        pos = 2

        voltage_count_in_frame = 15 if len(raw) == BmsFrameParser.FRAME_LEN_15S_LEGACY else 12

        all_voltage_values = []
        for _ in range(voltage_count_in_frame):
            all_voltage_values.append(u16_be(raw, pos))
            pos += 2

        cells: List[Optional[int]] = []
        for i in range(PACK_CELL_COUNT):
            value = all_voltage_values[i] if i < len(all_voltage_values) else 0
            cells.append(value if value > 0 else None)

        total_mv = u16_be(raw, pos)
        pos += 2

        soc = u16_be(raw, pos)
        pos += 2

        current_a = i16_be(raw, pos) * CURRENT_SCALE
        pos += 2

        temp1 = i8(raw[pos])
        pos += 1

        dsg_on = bool(raw[pos])
        pos += 1

        chg_on = bool(raw[pos])
        pos += 1

        max_mv = u16_be(raw, pos)
        pos += 2

        min_mv = u16_be(raw, pos)
        pos += 2

        temp2 = None
        if pos < len(raw):
            temp2 = i8(raw[pos])

        return PackData(
            pack_index=pack_index,
            header_id=header_id,
            cells_mv=cells,
            total_mv=total_mv if total_mv > 0 else None,
            soc=soc,
            current_a=current_a,
            temp1=temp1,
            temp2=temp2,
            dsg_on=dsg_on,
            chg_on=chg_on,
            max_mv=max_mv if max_mv > 0 else None,
            min_mv=min_mv if min_mv > 0 else None,
            raw_len=len(raw),
        )


class SerialWorker(QThread):
    pack_received = pyqtSignal(object)
    raw_received = pyqtSignal(bytes)
    log_received = pyqtSignal(str)
    error_occurred = pyqtSignal(str)
    opened = pyqtSignal()
    closed = pyqtSignal()

    def __init__(self, port: str, baudrate: int):
        super().__init__()

        self.port = port
        self.baudrate = baudrate
        self.serial_port: Optional[serial.Serial] = None
        self.running = False
        self.parser = BmsFrameParser()

        self.same_header_alternate = True
        self.next_same_header_pack = 1

    def run(self):
        try:
            self.serial_port = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                timeout=0.05,
            )

            self.running = True
            self.opened.emit()
            self.log_received.emit(f"{self.port} {self.baudrate} bps")

            while self.running:
                try:
                    waiting = self.serial_port.in_waiting
                    chunk = self.serial_port.read(waiting if waiting else 1)

                    if not chunk:
                        continue

                    self.raw_received.emit(chunk)
                    frames = self.parser.feed(chunk)

                    for raw in frames:
                        pack_index = self.resolve_pack_index(raw)
                        pack_data = BmsFrameParser.parse_pack_frame(raw, pack_index)
                        self.pack_received.emit(pack_data)

                except serial.SerialException as exc:
                    self.error_occurred.emit(str(exc))
                    break
                except Exception as exc:
                    self.error_occurred.emit(str(exc))
                    time.sleep(0.05)

        except Exception as exc:
            self.error_occurred.emit(str(exc))

        finally:
            self.running = False

            if self.serial_port is not None:
                try:
                    if self.serial_port.is_open:
                        self.serial_port.close()
                except Exception:
                    pass

            self.closed.emit()

    def resolve_pack_index(self, raw: bytes) -> int:
        header_id = raw[1]

        if header_id == 0x01:
            if self.same_header_alternate:
                pack_index = self.next_same_header_pack
                self.next_same_header_pack = 2 if self.next_same_header_pack == 1 else 1
                return pack_index
            return 1

        if header_id == 0x02:
            return 2

        return 1 if header_id % 2 == 1 else 2

    def set_same_header_alternate(self, enabled: bool):
        self.same_header_alternate = enabled
        self.next_same_header_pack = 1

    def write_bytes(self, payload: bytes):
        if self.serial_port is None or not self.serial_port.is_open:
            raise RuntimeError("Serial port is not open")

        self.serial_port.write(payload)

    def stop(self):
        self.running = False
        self.wait(1200)


class LogWindow(QDialog):
    def __init__(self, parent):
        super().__init__(parent)

        self.parent_window = parent
        self.setMinimumSize(760, 420)

        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)

        self.frame_count_label = QLabel()
        self.frame_count_edit = QLineEdit("0")
        self.frame_count_edit.setReadOnly(True)
        self.frame_count_edit.setAlignment(Qt.AlignCenter)
        self.frame_count_edit.setFixedWidth(90)
        self.frame_count_edit.setObjectName("ValueEdit")

        self.clear_btn = QPushButton()
        self.clear_btn.clicked.connect(self.clear_log)

        self.build_ui()
        self.apply_style()
        self.retranslate()

    def build_ui(self):
        layout = QVBoxLayout()
        layout.setContentsMargins(14, 14, 14, 14)

        bottom = QHBoxLayout()
        bottom.addWidget(self.frame_count_label)
        bottom.addWidget(self.frame_count_edit)
        bottom.addStretch(1)
        bottom.addWidget(self.clear_btn)

        layout.addWidget(self.log_text)
        layout.addLayout(bottom)

        self.setLayout(layout)

    def apply_style(self):
        self.setStyleSheet(
            """
            QDialog {
                background: #ECF6F7;
            }
            QLabel {
                color: #0065B3;
            }
            QTextEdit {
                background: #FFFFFF;
                border: 1px solid #C6D1DE;
                border-radius: 6px;
                padding: 6px;
            }
            QLineEdit#ValueEdit {
                background: #FFFFFF;
                border: 1px solid #C6D1DE;
                border-radius: 5px;
                padding: 2px 6px;
            }
            QPushButton {
                color: #005FCC;
                background: #FFFFFF;
                border: 1px solid #B9C8D8;
                border-radius: 6px;
                padding: 5px 12px;
            }
            QPushButton:hover {
                background: #EAF4FF;
            }
            """
        )

    def retranslate(self):
        tr = self.parent_window.tr_text
        self.setWindowTitle(tr("log_window_title"))
        self.frame_count_label.setText(tr("frame_count"))
        self.clear_btn.setText(tr("clear_log"))

    def append_log(self, text: str):
        now = time.strftime("%H:%M:%S")
        self.log_text.append(f"[{now}] {text}")
        bar = self.log_text.verticalScrollBar()
        bar.setValue(bar.maximum())

    def set_frame_count(self, count: int):
        self.frame_count_edit.setText(str(count))

    def clear_log(self):
        self.log_text.clear()
        self.parent_window.frame_count = 0
        self.set_frame_count(0)

    def closeEvent(self, event):
        self.parent_window.log_output_enabled = False
        event.accept()


class SettingsDialog(QDialog):
    def __init__(self, parent):
        super().__init__(parent)

        self.parent_window = parent
        self.language = parent.language

        self.selected_port = parent.selected_port
        self.selected_baudrate = parent.selected_baudrate
        self.same_header_alternate = parent.same_header_alternate
        self.log_output_enabled = parent.log_output_enabled

        self.setModal(True)
        self.setMinimumSize(560, 460)
        self.resize(560, 460)

        self.serial_group = QGroupBox()
        self.language_group = QGroupBox()
        self.debug_group = QGroupBox()

        self.port_label = QLabel()
        self.baud_label = QLabel()

        self.port_combo = QComboBox()
        self.port_combo.setMinimumWidth(300)

        self.baud_combo = QComboBox()
        self.refresh_btn = QPushButton()
        self.serial_toggle_btn = QPushButton()
        self.same_header_check = QCheckBox()

        self.zh_radio = QRadioButton()
        self.en_radio = QRadioButton()
        self.log_checkbox = QCheckBox()

        self.button_box = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)

        self.build_ui()
        self.apply_style()
        self.refresh_ports()
        self.refresh_text()
        self.update_serial_ui_state()

    def tr_text(self, key: str) -> str:
        return I18N[self.language].get(key, key)

    def build_ui(self):
        root = QVBoxLayout()
        root.setContentsMargins(18, 18, 18, 14)
        root.setSpacing(12)

        serial_layout = QGridLayout()
        serial_layout.setHorizontalSpacing(10)
        serial_layout.setVerticalSpacing(12)

        for baudrate in BAUDRATES:
            self.baud_combo.addItem(str(baudrate), baudrate)

        baud_index = self.baud_combo.findData(self.selected_baudrate)
        if baud_index < 0:
            baud_index = self.baud_combo.findData(DEFAULT_BAUDRATE)
        self.baud_combo.setCurrentIndex(baud_index)

        self.refresh_btn.clicked.connect(self.refresh_ports)
        self.serial_toggle_btn.clicked.connect(self.on_serial_toggle_clicked)
        self.same_header_check.setChecked(self.same_header_alternate)

        serial_layout.addWidget(self.port_label, 0, 0)
        serial_layout.addWidget(self.port_combo, 0, 1, 1, 2)
        serial_layout.addWidget(self.refresh_btn, 0, 3)

        serial_layout.addWidget(self.baud_label, 1, 0)
        serial_layout.addWidget(self.baud_combo, 1, 1)
        serial_layout.addWidget(self.serial_toggle_btn, 1, 2, 1, 2)

        serial_layout.addWidget(self.same_header_check, 2, 0, 1, 4)

        self.serial_group.setLayout(serial_layout)

        language_layout = QHBoxLayout()
        language_layout.setSpacing(40)

        self.zh_radio.setChecked(self.language == "zh")
        self.en_radio.setChecked(self.language == "en")
        self.zh_radio.toggled.connect(self.on_language_radio_changed)
        self.en_radio.toggled.connect(self.on_language_radio_changed)

        language_layout.addWidget(self.zh_radio)
        language_layout.addWidget(self.en_radio)
        language_layout.addStretch(1)

        self.language_group.setLayout(language_layout)

        debug_layout = QVBoxLayout()
        self.log_checkbox.setChecked(self.log_output_enabled)
        debug_layout.addWidget(self.log_checkbox)

        self.debug_group.setLayout(debug_layout)

        self.button_box.accepted.connect(self.accept)
        self.button_box.rejected.connect(self.reject)

        root.addWidget(self.serial_group)
        root.addWidget(self.language_group)
        root.addWidget(self.debug_group)
        root.addStretch(1)
        root.addWidget(self.button_box)

        self.setLayout(root)

    def apply_style(self):
        self.setStyleSheet(
            """
            QDialog {
                background: #ECF6F7;
            }

            QGroupBox {
                border: 1px solid #C8DCE0;
                border-radius: 8px;
                margin-top: 12px;
                padding: 14px;
                background: #F7FBFC;
            }

            QGroupBox::title {
                subcontrol-origin: margin;
                left: 12px;
                padding: 0 6px;
                color: #24435A;
                font-weight: 600;
                background: #ECF6F7;
            }

            QLabel,
            QCheckBox,
            QRadioButton {
                color: #005FCC;
                background: transparent;
            }

            QComboBox {
                background: #FFFFFF;
                border: 1px solid #C6D1DE;
                border-radius: 5px;
                padding: 4px 8px;
                min-height: 24px;
            }

            QPushButton {
                color: #005FCC;
                background: #FFFFFF;
                border: 1px solid #B9C8D8;
                border-radius: 6px;
                padding: 6px 14px;
                min-height: 24px;
            }

            QPushButton:hover {
                background: #EAF4FF;
                border: 1px solid #78AEEA;
            }

            QPushButton:disabled {
                color: #8A96A3;
                background: #EEF1F4;
                border: 1px solid #CDD5DD;
            }
            """
        )

    def refresh_text(self):
        self.setWindowTitle(self.tr_text("settings_title"))

        self.serial_group.setTitle(self.tr_text("serial_group"))
        self.language_group.setTitle(self.tr_text("language_group"))
        self.debug_group.setTitle(self.tr_text("debug_group"))

        self.port_label.setText(self.tr_text("port"))
        self.baud_label.setText(self.tr_text("baudrate"))
        self.refresh_btn.setText(self.tr_text("refresh_port"))
        self.same_header_check.setText(self.tr_text("same_header"))
        self.log_checkbox.setText(self.tr_text("log_output"))

        self.zh_radio.setText(self.tr_text("chinese"))
        self.en_radio.setText(self.tr_text("english"))

        if self.parent_window.worker is None:
            self.serial_toggle_btn.setText(self.tr_text("open_serial"))
        else:
            self.serial_toggle_btn.setText(self.tr_text("close_serial"))

        ok_button = self.button_box.button(QDialogButtonBox.Ok)
        cancel_button = self.button_box.button(QDialogButtonBox.Cancel)

        if ok_button:
            ok_button.setText(self.tr_text("ok"))
        if cancel_button:
            cancel_button.setText(self.tr_text("cancel"))

    def on_language_radio_changed(self):
        if self.zh_radio.isChecked():
            self.language = "zh"
        elif self.en_radio.isChecked():
            self.language = "en"
        self.refresh_text()

    def refresh_ports(self):
        current = self.selected_port or self.port_combo.currentData()
        self.port_combo.clear()

        ports = list(serial.tools.list_ports.comports())
        for port in ports:
            self.port_combo.addItem(f"{port.device}  {port.description}", port.device)

        if current:
            for i in range(self.port_combo.count()):
                if self.port_combo.itemData(i) == current:
                    self.port_combo.setCurrentIndex(i)
                    break

    def update_serial_ui_state(self):
        serial_open = self.parent_window.worker is not None

        self.port_combo.setEnabled(not serial_open)
        self.baud_combo.setEnabled(not serial_open)
        self.refresh_btn.setEnabled(not serial_open)

        if serial_open:
            self.serial_toggle_btn.setText(self.tr_text("close_serial"))
        else:
            self.serial_toggle_btn.setText(self.tr_text("open_serial"))

    def on_serial_toggle_clicked(self):
        if self.parent_window.worker is None:
            port = self.port_combo.currentData()

            if not port:
                QMessageBox.warning(
                    self,
                    self.tr_text("message_title"),
                    self.tr_text("select_port"),
                )
                return

            self.parent_window.selected_port = port
            self.parent_window.selected_baudrate = int(self.baud_combo.currentData())
            self.parent_window.same_header_alternate = self.same_header_check.isChecked()
            self.parent_window.retranslate()
            self.parent_window.toggle_serial()
        else:
            self.parent_window.close_serial()

        QTimer.singleShot(300, self.update_serial_ui_state)

    def get_values(self):
        language = "en" if self.en_radio.isChecked() else "zh"

        if self.parent_window.worker is None:
            port = self.port_combo.currentData()
            baudrate = int(self.baud_combo.currentData())
        else:
            port = self.parent_window.selected_port
            baudrate = self.parent_window.selected_baudrate

        log_output = self.log_checkbox.isChecked()
        same_header = self.same_header_check.isChecked()

        return language, port, baudrate, log_output, same_header


class PackPanel(QGroupBox):
    def __init__(self, pack_index: int, first_cell_no: int, main_window):
        super().__init__()

        self.main_window = main_window
        self.pack_index = pack_index
        self.first_cell_no = first_cell_no

        self.cell_edits: List[QLineEdit] = []

        self.title_label = QLabel()
        self.soc_title = QLabel()

        self.total_voltage_label = QLabel()
        self.current_label = QLabel()
        self.temp1_label = QLabel()
        self.temp2_label = QLabel()
        self.max_label = QLabel()
        self.min_label = QLabel()
        self.diff_label = QLabel()
        self.frame_len_label = QLabel()

        self.total_voltage_unit = QLabel("mV")
        self.current_unit = QLabel("A")
        self.temp1_unit = QLabel("℃")
        self.temp2_unit = QLabel("℃")
        self.max_unit = QLabel("mV")
        self.min_unit = QLabel("mV")
        self.diff_unit = QLabel("mV")
        self.frame_len_unit = QLabel()

        self.total_voltage_edit = self.make_value_edit()
        self.current_edit = self.make_value_edit()
        self.soc_edit = self.make_value_edit()
        self.temp1_edit = self.make_value_edit()
        self.temp2_edit = self.make_value_edit()
        self.max_cell_edit = self.make_value_edit()
        self.min_cell_edit = self.make_value_edit()
        self.diff_edit = self.make_value_edit()
        self.frame_len_edit = self.make_value_edit()

        self.soc_bar = QProgressBar()
        self.soc_bar.setRange(0, 100)
        self.soc_bar.setValue(0)
        self.soc_bar.setTextVisible(False)
        self.soc_bar.setFixedHeight(16)
        self.soc_bar.setStyleSheet(
            """
            QProgressBar {
                border: 1px solid #C6D1DE;
                border-radius: 6px;
                background: #EEF3F7;
            }
            QProgressBar::chunk {
                border-radius: 6px;
                background: #28A745;
            }
            """
        )

        self.build_ui()
        self.retranslate()

    def build_ui(self):
        root = QVBoxLayout()
        root.setSpacing(12)
        root.setContentsMargins(14, 20, 14, 14)

        top = QHBoxLayout()
        self.title_label.setObjectName("PackTitle")
        self.soc_title.setObjectName("SubLabel")

        top.addWidget(self.title_label)
        top.addStretch(1)
        top.addWidget(self.soc_title)
        top.addWidget(self.soc_bar, 2)
        top.addWidget(self.soc_edit)

        root.addLayout(top)

        cell_grid = QGridLayout()
        cell_grid.setHorizontalSpacing(12)
        cell_grid.setVerticalSpacing(10)

        for i in range(PACK_CELL_COUNT):
            cell_no = self.first_cell_no + i
            row = i % 6
            block = i // 6
            col = block * 3

            label = QLabel(f"C{cell_no:02d}")
            label.setObjectName("CellLabel")
            label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)

            edit = self.make_value_edit()

            unit = QLabel("mV")
            unit.setObjectName("UnitLabel")

            cell_grid.addWidget(label, row, col)
            cell_grid.addWidget(edit, row, col + 1)
            cell_grid.addWidget(unit, row, col + 2)

            self.cell_edits.append(edit)

        root.addLayout(cell_grid)

        info_grid = QGridLayout()
        info_grid.setHorizontalSpacing(12)
        info_grid.setVerticalSpacing(10)

        items = [
            (self.total_voltage_label, self.total_voltage_edit, self.total_voltage_unit),
            (self.current_label, self.current_edit, self.current_unit),
            (self.temp1_label, self.temp1_edit, self.temp1_unit),
            (self.temp2_label, self.temp2_edit, self.temp2_unit),
            (self.max_label, self.max_cell_edit, self.max_unit),
            (self.min_label, self.min_cell_edit, self.min_unit),
            (self.diff_label, self.diff_edit, self.diff_unit),
            (self.frame_len_label, self.frame_len_edit, self.frame_len_unit),
        ]

        for index, (name_label, edit, unit_label) in enumerate(items):
            row = index // 4
            col = (index % 4) * 3

            name_label.setObjectName("InfoLabel")
            unit_label.setObjectName("UnitLabel")

            info_grid.addWidget(name_label, row, col)
            info_grid.addWidget(edit, row, col + 1)
            info_grid.addWidget(unit_label, row, col + 2)

        root.addLayout(info_grid)
        self.setLayout(root)

    @staticmethod
    def make_value_edit() -> QLineEdit:
        edit = QLineEdit("--")
        edit.setReadOnly(True)
        edit.setAlignment(Qt.AlignCenter)
        edit.setFixedWidth(92)
        edit.setFixedHeight(28)
        edit.setObjectName("ValueEdit")
        return edit

    def retranslate(self):
        tr = self.main_window.tr_text

        self.setTitle(f"PACK{self.pack_index}")
        self.title_label.setText(f"PACK{self.pack_index}  {tr('pack_board')}")
        self.soc_title.setText(tr("soc"))

        self.total_voltage_label.setText(tr("voltage_total"))
        self.current_label.setText(tr("current"))
        self.temp1_label.setText(tr("temp1"))
        self.temp2_label.setText(tr("temp2"))
        self.max_label.setText(tr("max"))
        self.min_label.setText(tr("min"))
        self.diff_label.setText(tr("balance"))
        self.frame_len_label.setText(tr("frame_len"))
        self.frame_len_unit.setText(tr("byte"))

    def update_data(self, data: PackData):
        for index in range(PACK_CELL_COUNT):
            value = data.cells_mv[index] if index < len(data.cells_mv) else None
            self.cell_edits[index].setText("--" if value is None else str(value))

        valid_cells = [v for v in data.cells_mv if v is not None and v > 0]

        if data.total_mv is not None:
            self.total_voltage_edit.setText(str(data.total_mv))
        elif valid_cells:
            self.total_voltage_edit.setText(str(sum(valid_cells)))
        else:
            self.total_voltage_edit.setText("--")

        self.current_edit.setText("--" if data.current_a is None else f"{data.current_a:.2f}")
        self.soc_edit.setText("--" if data.soc is None else str(data.soc))
        self.temp1_edit.setText("--" if data.temp1 is None else str(data.temp1))
        self.temp2_edit.setText("--" if data.temp2 is None else str(data.temp2))

        if data.max_mv is not None:
            self.max_cell_edit.setText(str(data.max_mv))
        elif valid_cells:
            self.max_cell_edit.setText(str(max(valid_cells)))
        else:
            self.max_cell_edit.setText("--")

        if data.min_mv is not None:
            self.min_cell_edit.setText(str(data.min_mv))
        elif valid_cells:
            self.min_cell_edit.setText(str(min(valid_cells)))
        else:
            self.min_cell_edit.setText("--")

        if valid_cells:
            self.diff_edit.setText(str(max(valid_cells) - min(valid_cells)))
        else:
            self.diff_edit.setText("--")

        self.frame_len_edit.setText(str(data.raw_len))

        if data.soc is None:
            self.soc_bar.setValue(0)
        else:
            self.soc_bar.setValue(max(0, min(100, int(data.soc))))

    def clear_data(self):
        for edit in self.cell_edits:
            edit.setText("--")

        for edit in [
            self.total_voltage_edit,
            self.current_edit,
            self.soc_edit,
            self.temp1_edit,
            self.temp2_edit,
            self.max_cell_edit,
            self.min_cell_edit,
            self.diff_edit,
            self.frame_len_edit,
        ]:
            edit.setText("--")

        self.soc_bar.setValue(0)


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()

        self.language = "zh"

        self.selected_port: Optional[str] = None
        self.selected_baudrate = DEFAULT_BAUDRATE
        self.same_header_alternate = True

        self.log_output_enabled = False
        self.log_window: Optional[LogWindow] = None

        self.worker: Optional[SerialWorker] = None
        self.pack_data: Dict[int, PackData] = {}
        self.frame_count = 0

        self.resize(1380, 1000)
        self.setMinimumSize(1280, 900)

        font = QFont("Microsoft YaHei", 9)
        self.setFont(font)

        self.central = QWidget()
        self.setCentralWidget(self.central)

        self.build_ui()
        self.apply_style()
        self.init_default_serial()
        self.set_control_buttons_enabled(False)
        self.retranslate()

        self.port_timer = QTimer(self)
        self.port_timer.timeout.connect(self.refresh_serial_cache)
        self.port_timer.start(2000)

        self.clock_timer = QTimer(self)
        self.clock_timer.timeout.connect(self.update_clock)
        self.clock_timer.start(1000)
        self.update_clock()

        self.setStatusBar(QStatusBar())
        self.statusBar().showMessage(self.tr_text("disconnected"))

    def tr_text(self, key: str) -> str:
        return I18N[self.language].get(key, key)

    def build_ui(self):
        root = QVBoxLayout(self.central)
        root.setContentsMargins(16, 16, 16, 12)
        root.setSpacing(12)

        top_bar = QHBoxLayout()
        self.settings_btn = QPushButton()
        self.settings_btn.setFixedSize(90, 34)
        self.settings_btn.clicked.connect(self.open_settings)

        self.connection_status_label = QLabel()
        self.connection_status_label.setObjectName("StatusLabel")

        self.footer_label = QLabel()
        self.footer_label.setObjectName("FooterLabel")

        self.clock_label = QLabel("")
        self.clock_label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
        self.clock_label.setObjectName("ClockLabel")

        top_bar.addWidget(self.settings_btn)
        top_bar.addWidget(self.connection_status_label)
        top_bar.addStretch(1)
        top_bar.addWidget(self.footer_label)
        top_bar.addStretch(1)
        top_bar.addWidget(self.clock_label)

        root.addLayout(top_bar)

        main_layout = QHBoxLayout()
        main_layout.setSpacing(12)

        pack_layout = QVBoxLayout()
        pack_layout.setSpacing(12)

        self.pack1_panel = PackPanel(1, 1, self)
        self.pack2_panel = PackPanel(2, 13, self)

        pack_layout.addWidget(self.pack1_panel)
        pack_layout.addWidget(self.pack2_panel)

        self.summary_group = self.build_summary_group()

        main_layout.addLayout(pack_layout, 5)
        main_layout.addWidget(self.summary_group, 2)

        root.addLayout(main_layout, 1)

        self.control_group = self.build_command_group()
        root.addWidget(self.control_group)

    def build_summary_group(self) -> QGroupBox:
        group = QGroupBox()
        layout = QGridLayout()
        layout.setHorizontalSpacing(12)
        layout.setVerticalSpacing(12)

        self.total_24s_voltage_label = QLabel()
        self.total_soc_label = QLabel()
        self.pack1_soc_label = QLabel()
        self.pack2_soc_label = QLabel()
        self.max_24s_label = QLabel()
        self.min_24s_label = QLabel()
        self.diff_24s_label = QLabel()

        self.total_24s_voltage_edit = self.make_small_value_edit()
        self.total_soc_edit = self.make_small_value_edit()
        self.pack1_soc_edit = self.make_small_value_edit()
        self.pack2_soc_edit = self.make_small_value_edit()
        self.max_24s_edit = self.make_small_value_edit()
        self.min_24s_edit = self.make_small_value_edit()
        self.diff_24s_edit = self.make_small_value_edit()

        self.total_24s_voltage_unit = QLabel("mV")
        self.total_soc_unit = QLabel("%")
        self.pack1_soc_unit = QLabel("%")
        self.pack2_soc_unit = QLabel("%")
        self.max_24s_unit = QLabel("mV")
        self.min_24s_unit = QLabel("mV")
        self.diff_24s_unit = QLabel("mV")

        labels = [
            self.total_24s_voltage_label,
            self.total_soc_label,
            self.pack1_soc_label,
            self.pack2_soc_label,
            self.max_24s_label,
            self.min_24s_label,
            self.diff_24s_label,
            self.total_24s_voltage_unit,
            self.total_soc_unit,
            self.pack1_soc_unit,
            self.pack2_soc_unit,
            self.max_24s_unit,
            self.min_24s_unit,
            self.diff_24s_unit,
        ]

        for label in labels:
            label.setObjectName("BlueLabel")

        rows = [
            (self.total_24s_voltage_label, self.total_24s_voltage_edit, self.total_24s_voltage_unit),
            (self.total_soc_label, self.total_soc_edit, self.total_soc_unit),
            (self.pack1_soc_label, self.pack1_soc_edit, self.pack1_soc_unit),
            (self.pack2_soc_label, self.pack2_soc_edit, self.pack2_soc_unit),
            (self.max_24s_label, self.max_24s_edit, self.max_24s_unit),
            (self.min_24s_label, self.min_24s_edit, self.min_24s_unit),
            (self.diff_24s_label, self.diff_24s_edit, self.diff_24s_unit),
        ]

        for row, (name_label, edit, unit_label) in enumerate(rows):
            layout.addWidget(name_label, row, 0)
            layout.addWidget(edit, row, 1)
            layout.addWidget(unit_label, row, 2)

        layout.setRowStretch(len(rows), 1)
        group.setLayout(layout)
        return group

    def build_command_group(self) -> QGroupBox:
        group = QGroupBox()
        layout = QHBoxLayout()
        layout.setSpacing(14)
        layout.setContentsMargins(14, 18, 14, 14)

        self.start_btn = QPushButton()
        self.stop_btn = QPushButton()
        self.open_dsg_btn = QPushButton()
        self.close_dsg_btn = QPushButton()
        self.open_chg_btn = QPushButton()
        self.close_chg_btn = QPushButton()
        self.clear_value_btn = QPushButton()
        self.exit_btn = QPushButton()

        self.start_btn.clicked.connect(lambda: self.send_command(CMD_START_COLLECT, self.tr_text("start")))
        self.stop_btn.clicked.connect(lambda: self.send_command(CMD_STOP_COLLECT, self.tr_text("stop")))
        self.open_dsg_btn.clicked.connect(lambda: self.send_command(CMD_OPEN_DSG, self.tr_text("open_dsg")))
        self.close_dsg_btn.clicked.connect(lambda: self.send_command(CMD_CLOSE_DSG, self.tr_text("close_dsg")))
        self.open_chg_btn.clicked.connect(lambda: self.send_command(CMD_OPEN_CHG, self.tr_text("open_chg")))
        self.close_chg_btn.clicked.connect(lambda: self.send_command(CMD_CLOSE_CHG, self.tr_text("close_chg")))
        self.clear_value_btn.clicked.connect(self.clear_values)
        self.exit_btn.clicked.connect(self.close)

        buttons = [
            self.start_btn,
            self.stop_btn,
            self.open_dsg_btn,
            self.close_dsg_btn,
            self.open_chg_btn,
            self.close_chg_btn,
            self.clear_value_btn,
            self.exit_btn,
        ]

        for button in buttons:
            button.setMinimumWidth(126)
            button.setFixedHeight(36)
            layout.addWidget(button)

        layout.addStretch(1)
        group.setLayout(layout)
        return group

    @staticmethod
    def make_small_value_edit() -> QLineEdit:
        edit = QLineEdit("--")
        edit.setReadOnly(True)
        edit.setAlignment(Qt.AlignCenter)
        edit.setFixedWidth(104)
        edit.setFixedHeight(30)
        edit.setObjectName("ValueEdit")
        return edit

    def apply_style(self):
        self.central.setStyleSheet(
            """
            QWidget {
                background: #ECF6F7;
                color: #1F2933;
            }

            QGroupBox {
                border: 1px solid #C8DCE0;
                border-radius: 8px;
                margin-top: 12px;
                padding: 10px;
                background: #F7FBFC;
            }

            QGroupBox::title {
                subcontrol-origin: margin;
                left: 12px;
                padding: 0 6px;
                color: #24435A;
                font-weight: 600;
                background: #ECF6F7;
            }

            QLabel#BlueLabel,
            QLabel#CellLabel,
            QLabel#InfoLabel,
            QLabel#UnitLabel,
            QLabel#SubLabel {
                color: #0065B3;
            }

            QLabel#PackTitle {
                color: #24435A;
                font-size: 15px;
                font-weight: 600;
            }

            QLabel#FooterLabel {
                color: #0065B3;
                font-size: 16px;
                font-weight: 600;
            }

            QLabel#ClockLabel {
                color: #111827;
                font-size: 18px;
                font-weight: 500;
            }

            QLabel#StatusLabel {
                color: #24435A;
                font-size: 14px;
                padding-left: 12px;
            }

            QLineEdit#ValueEdit {
                background: #FFFFFF;
                border: 1px solid #C6D1DE;
                border-radius: 5px;
                padding: 2px 6px;
                color: #111827;
            }

            QPushButton {
                color: #005FCC;
                background: #FFFFFF;
                border: 1px solid #B9C8D8;
                border-radius: 6px;
                padding: 5px 10px;
            }

            QPushButton:hover {
                background: #EAF4FF;
                border: 1px solid #78AEEA;
            }

            QPushButton:pressed {
                background: #D8EBFF;
            }

            QPushButton:disabled {
                color: #8A96A3;
                background: #EEF1F4;
                border: 1px solid #CDD5DD;
            }
            """
        )

    def init_default_serial(self):
        ports = list(serial.tools.list_ports.comports())
        if ports:
            self.selected_port = ports[0].device
        else:
            self.selected_port = None

    def refresh_serial_cache(self):
        if self.worker is not None:
            return

        if self.selected_port:
            ports = [p.device for p in serial.tools.list_ports.comports()]
            if self.selected_port not in ports:
                self.selected_port = ports[0] if ports else None
                self.retranslate()

    def retranslate(self):
        self.setWindowTitle(self.tr_text("window_title"))

        self.settings_btn.setText(self.tr_text("settings"))
        self.summary_group.setTitle(self.tr_text("summary_group"))
        self.control_group.setTitle(self.tr_text("control_group"))
        self.footer_label.setText(self.tr_text("footer"))

        status = self.tr_text("connected") if self.worker is not None else self.tr_text("disconnected")
        port_text = self.selected_port if self.selected_port else "--"

        self.connection_status_label.setText(
            f"{status}    {self.tr_text('port')}: {port_text}    {self.tr_text('baudrate')}: {self.selected_baudrate}"
        )

        self.total_24s_voltage_label.setText(self.tr_text("total_voltage"))
        self.total_soc_label.setText(self.tr_text("avg_soc"))
        self.pack1_soc_label.setText(self.tr_text("pack1_soc"))
        self.pack2_soc_label.setText(self.tr_text("pack2_soc"))
        self.max_24s_label.setText(self.tr_text("max_cell"))
        self.min_24s_label.setText(self.tr_text("min_cell"))
        self.diff_24s_label.setText(self.tr_text("diff"))

        self.start_btn.setText(self.tr_text("start"))
        self.stop_btn.setText(self.tr_text("stop"))
        self.open_dsg_btn.setText(self.tr_text("open_dsg"))
        self.close_dsg_btn.setText(self.tr_text("close_dsg"))
        self.open_chg_btn.setText(self.tr_text("open_chg"))
        self.close_chg_btn.setText(self.tr_text("close_chg"))
        self.clear_value_btn.setText(self.tr_text("clear_values"))
        self.exit_btn.setText(self.tr_text("exit"))

        self.pack1_panel.retranslate()
        self.pack2_panel.retranslate()

        if self.log_window:
            self.log_window.retranslate()

        if self.statusBar():
            self.statusBar().showMessage(status)

    def open_settings(self):
        dialog = SettingsDialog(self)

        if dialog.exec_() == QDialog.Accepted:
            language, port, baudrate, log_output, same_header = dialog.get_values()

            if self.worker is not None and (port != self.selected_port or baudrate != self.selected_baudrate):
                QMessageBox.warning(
                    self,
                    self.tr_text("message_title"),
                    self.tr_text("serial_open_notice"),
                )
                language = self.language
                port = self.selected_port
                baudrate = self.selected_baudrate

            self.language = language
            self.selected_port = port
            self.selected_baudrate = baudrate
            self.log_output_enabled = log_output
            self.same_header_alternate = same_header

            if self.worker is not None:
                self.worker.set_same_header_alternate(self.same_header_alternate)

            self.apply_log_window_state()
            self.retranslate()
            self.append_debug(self.tr_text("settings_saved"))

    def apply_log_window_state(self):
        if self.log_output_enabled:
            if self.log_window is None:
                self.log_window = LogWindow(self)
            self.log_window.retranslate()
            self.log_window.set_frame_count(self.frame_count)
            self.log_window.show()
            self.log_window.raise_()
            self.log_window.activateWindow()
        else:
            if self.log_window is not None:
                self.log_window.close()
                self.log_window = None

    def toggle_serial(self):
        if self.worker is not None:
            self.close_serial()
            return

        if not self.selected_port:
            QMessageBox.warning(self, self.tr_text("message_title"), self.tr_text("select_port"))
            return

        self.worker = SerialWorker(self.selected_port, self.selected_baudrate)
        self.worker.set_same_header_alternate(self.same_header_alternate)

        self.worker.pack_received.connect(self.on_pack_data)
        self.worker.raw_received.connect(self.on_raw_data)
        self.worker.log_received.connect(self.on_worker_log)
        self.worker.error_occurred.connect(self.on_error)
        self.worker.opened.connect(self.on_serial_opened)
        self.worker.closed.connect(self.on_serial_closed)

        self.worker.start()

    def close_serial(self):
        if self.worker is not None:
            self.worker.stop()

    def on_serial_opened(self):
        self.set_control_buttons_enabled(True)
        self.statusBar().showMessage(self.tr_text("connected"))
        self.retranslate()

    def on_serial_closed(self):
        self.set_control_buttons_enabled(False)
        self.statusBar().showMessage(self.tr_text("disconnected"))
        self.worker = None
        self.append_debug(self.tr_text("serial_closed"))
        self.retranslate()

    def set_control_buttons_enabled(self, enabled: bool):
        for button in [
            self.start_btn,
            self.stop_btn,
            self.open_dsg_btn,
            self.close_dsg_btn,
            self.open_chg_btn,
            self.close_chg_btn,
        ]:
            button.setEnabled(enabled)

    def send_command(self, payload: bytes, action: str):
        if self.worker is None:
            QMessageBox.warning(self, self.tr_text("message_title"), self.tr_text("open_port_first"))
            return

        try:
            self.worker.write_bytes(payload)
            self.append_debug(f"{self.tr_text('sent')}: {action}    {payload.hex(' ').upper()}")
        except Exception as exc:
            self.on_error(str(exc))

    def on_raw_data(self, data: bytes):
        pass

    def on_worker_log(self, text: str):
        self.append_debug(f"{self.tr_text('serial_connected')}  {text}")

    def on_pack_data(self, data: PackData):
        self.frame_count += 1

        if self.log_window:
            self.log_window.set_frame_count(self.frame_count)

        self.pack_data[data.pack_index] = data

        if data.pack_index == 1:
            self.pack1_panel.update_data(data)
        else:
            self.pack2_panel.update_data(data)

        self.update_total_summary()

        self.append_debug(
            f"{self.tr_text('received')} PACK{data.pack_index} {self.tr_text('data')}  "
            f"{self.tr_text('header')} AA{data.header_id:02X}  "
            f"{self.tr_text('frame_len')} {data.raw_len}  "
            f"SOC {self.format_value(data.soc)}%  "
            f"{self.tr_text('voltage_total')} {self.format_value(data.total_mv)}mV"
        )

    def update_total_summary(self):
        pack1 = self.pack_data.get(1)
        pack2 = self.pack_data.get(2)

        total_voltage = 0
        has_voltage = False

        if pack1 and pack1.total_mv is not None:
            total_voltage += pack1.total_mv
            has_voltage = True

        if pack2 and pack2.total_mv is not None:
            total_voltage += pack2.total_mv
            has_voltage = True

        self.total_24s_voltage_edit.setText(str(total_voltage) if has_voltage else "--")

        soc_values = []

        if pack1 and pack1.soc is not None:
            self.pack1_soc_edit.setText(str(pack1.soc))
            soc_values.append(pack1.soc)
        else:
            self.pack1_soc_edit.setText("--")

        if pack2 and pack2.soc is not None:
            self.pack2_soc_edit.setText(str(pack2.soc))
            soc_values.append(pack2.soc)
        else:
            self.pack2_soc_edit.setText("--")

        if soc_values:
            self.total_soc_edit.setText(str(int(sum(soc_values) / len(soc_values))))
        else:
            self.total_soc_edit.setText("--")

        all_cells = []

        if pack1:
            all_cells.extend([v for v in pack1.cells_mv if v is not None and v > 0])

        if pack2:
            all_cells.extend([v for v in pack2.cells_mv if v is not None and v > 0])

        if all_cells:
            max_cell = max(all_cells)
            min_cell = min(all_cells)
            self.max_24s_edit.setText(str(max_cell))
            self.min_24s_edit.setText(str(min_cell))
            self.diff_24s_edit.setText(str(max_cell - min_cell))
        else:
            self.max_24s_edit.setText("--")
            self.min_24s_edit.setText("--")
            self.diff_24s_edit.setText("--")

    def clear_values(self):
        self.pack_data.clear()
        self.pack1_panel.clear_data()
        self.pack2_panel.clear_data()

        for edit in [
            self.total_24s_voltage_edit,
            self.total_soc_edit,
            self.pack1_soc_edit,
            self.pack2_soc_edit,
            self.max_24s_edit,
            self.min_24s_edit,
            self.diff_24s_edit,
        ]:
            edit.setText("--")

        self.append_debug(self.tr_text("values_cleared"))

    def append_debug(self, text: str):
        if not self.log_output_enabled:
            return

        if self.log_window is None:
            self.log_window = LogWindow(self)
            self.log_window.show()

        self.log_window.append_log(text)

    def on_error(self, text: str):
        self.append_debug(f"{self.tr_text('parse_error')}: {text}")
        self.statusBar().showMessage(text)

    @staticmethod
    def format_value(value):
        return "--" if value is None else str(value)

    def update_clock(self):
        self.clock_label.setText(time.strftime("%Y/%m/%d %H:%M:%S"))

    def closeEvent(self, event):
        if self.worker is not None:
            self.worker.stop()

        if self.log_window is not None:
            self.log_window.close()

        event.accept()


def main():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
