import { Container } from "inversify"
import { ControllerModule } from "./ControllerModule"
import { CoreModule } from "./CoreModule"
import { FactoryModule } from "./FactoryModule"
import { ManagerModule } from "./ManagerModule"
import { ModelModule } from "./ModelModule"
import { ServiceModule } from "./ServiceModule"
import { UIModule } from "./UIModule"
import { UtilityModule } from "./UtilityModule"

const DIContainer = new Container()

DIContainer.load(
    UtilityModule, // 1. 유틸리티 (Time, Size 등 - 의존성 없음)
    ServiceModule, // 2. 서비스 (Resources 등 - 유틸리티에 의존)
    ModelModule, // 3. 모델 (TreeLights, Floor 등 - 서비스에 의존)
    FactoryModule, // 4. 팩토리 (모델에 의존)
    ManagerModule, // 5. 매니저 (팩토리에 의존)
    UIModule, // 6. UI (매니저에 의존)
    CoreModule, // 7. 코어 (매니저, 서비스에 의존)
    ControllerModule, // 8. 컨트롤러
)

export { DIContainer }
