from abc import ABC, abstractmethod

class IStemExtractor(ABC):
    @abstractmethod
    def extract(self, audio_path: str, stems: int) -> str:
        raise NotImplementedError
