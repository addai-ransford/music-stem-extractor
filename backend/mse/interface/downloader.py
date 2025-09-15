from abc import ABC, abstractmethod

class IAudioDownloader(ABC):
    @abstractmethod
    def download(self, url: str) -> str:
        raise NotImplementedError
