package io.sited.pincode;

import io.sited.database.DatabaseModule;
import io.sited.email.smtp.SMTPModule;
import io.sited.message.MessageModule;
import io.sited.service.ServiceModule;
import io.sited.test.AppExtension;
import io.sited.test.Install;
import io.sited.test.MockApp;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import javax.inject.Inject;

import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * @author chi
 */
@ExtendWith(AppExtension.class)
@Install({PinCodeModuleImpl.class, SMTPModule.class, DatabaseModule.class, MessageModule.class, ServiceModule.class})
public class PinCodeModuleImplTest {
    @Inject
    MockApp app;

    @Test
    public void configure() {
        assertNotNull(app);
    }
}