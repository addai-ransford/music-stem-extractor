from abc import ABC, abstractmethod
from typing import List

class IFeatureExtractor(ABC):
    @abstractmethod
    def detect_key(self, audio_path: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def extract_chords(self, audio_path: str) -> List[dict]:
        raise NotImplementedError

    @abstractmethod
    def extract_melody(self, audio_path: str) -> List[str]:
        raise NotImplementedError
