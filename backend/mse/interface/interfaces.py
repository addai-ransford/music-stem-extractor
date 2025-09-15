from abc import ABC, abstractmethod
from typing import List

class IStemExtractor(ABC):
    @abstractmethod
    def extract(self, audio_path: str, stems: int) -> str:
        """Return path to folder containing stems."""

class IAudioDownloader(ABC):
    @abstractmethod
    def download(self, url: str) -> str:
        """Download audio from URL and return local filepath."""

